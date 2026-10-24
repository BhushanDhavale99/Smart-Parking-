import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ParkingLevelRow = Database["public"]["Tables"]["parking_levels"]["Row"];
export type ParkingSlotRow = Database["public"]["Tables"]["parking_slots"]["Row"];

export type ParkingSlotWithOccupancy = ParkingSlotRow & {
  is_occupied: boolean;
  current_booking?: {
    id: string;
    reference: string;
    status: string;
    start_at: string;
    end_at: string;
    plate_snapshot?: string | null;
  } | null;
};

// ── Shared Helper: Create Per-Request Scoped Supabase Client ──
async function getScopedClient(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error("[parking.server] Supabase configuration missing on server");
    throw new Response("Service configuration missing", { status: 500 });
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false },
  });
}

// ── 1. listSlots ─────────────────────────────────────────────
// Filters: level, zone, slot_type, admin_status, search, pagination.
// Requires valid authenticated user; executes query with caller's own token (RLS enforced).
// Computes live occupancy state from bookings and active sessions.
const listSlotsSchema = z.object({
  level: z.enum(["All", "B2", "B1", "G1", "L1", "L2"]).default("All"),
  zone: z.enum(["All", "A", "B", "EV"]).default("All"),
  slot_type: z.enum(["All", "standard", "ev", "accessible"]).default("All"),
  admin_status: z.enum(["All", "active", "maintenance", "blocked"]).default("All"),
  search: z.string().max(50).default(""),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(0).max(200).default(0), // 0 means return all matching
});

export type ListSlotsInput = z.infer<typeof listSlotsSchema>;

export const listSlots = createServerFn({ method: "GET" })
  .validator((params: Partial<ListSlotsInput>) => listSlotsSchema.parse(params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    let query = client
      .from("parking_slots")
      .select("*, parking_levels(code, name, sort_order, allows_heavy)", { count: "exact" });

    if (data.level !== "All") {
      query = query.eq("level_code", data.level);
    }
    if (data.zone !== "All") {
      query = query.eq("zone", data.zone);
    }
    if (data.slot_type !== "All") {
      query = query.eq("slot_type", data.slot_type);
    }
    if (data.admin_status !== "All") {
      query = query.eq("admin_status", data.admin_status);
    }
    if (data.search.trim()) {
      query = query.ilike("code", `%${data.search.trim()}%`);
    }

    query = query.order("level_code", { ascending: true }).order("bay_number", { ascending: true });

    if (data.pageSize > 0) {
      const from = (data.page - 1) * data.pageSize;
      const to = from + data.pageSize - 1;
      query = query.range(from, to);
    }

    const { data: rawSlots, error, count } = await query;
    if (error) {
      console.error("[listSlots] Supabase error:", error.message);
      throw new Response("Failed to fetch parking slots", { status: 500 });
    }

    const slots = rawSlots || [];
    const totalCount = count ?? slots.length;
    const totalPages = data.pageSize > 0 ? Math.ceil(totalCount / data.pageSize) || 1 : 1;

    if (slots.length === 0) {
      return {
        slots: [] as ParkingSlotWithOccupancy[],
        totalCount: 0,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: 1,
      };
    }

    // Compute live occupancy for the returned bays
    const now = new Date();
    const nowIso = now.toISOString();
    const slotIds = slots.map((s) => s.id);

    const activeBookingMap = new Map<
      string,
      {
        id: string;
        reference: string;
        status: string;
        start_at: string;
        end_at: string;
        plate_snapshot?: string | null;
      }
    >();
    const occupiedSlotIdSet = new Set<string>();

    if (authUser.role === "admin") {
      // Admins query public.bookings and public.parking_sessions directly
      const [bookingsRes, sessionsRes] = await Promise.all([
        client
          .from("bookings")
          .select("id, slot_id, reference, status, start_at, end_at, plate_snapshot")
          .in("slot_id", slotIds)
          .in("status", ["reserved", "confirmed", "active"])
          .lte("start_at", nowIso)
          .gte("end_at", nowIso),
        client
          .from("parking_sessions")
          .select("booking_id")
          .eq("status", "active")
          .is("ended_at", null),
      ]);

      if (bookingsRes.data) {
        for (const b of bookingsRes.data) {
          occupiedSlotIdSet.add(b.slot_id);
          activeBookingMap.set(b.slot_id, {
            id: b.id,
            reference: b.reference,
            status: b.status,
            start_at: b.start_at,
            end_at: b.end_at,
            plate_snapshot: b.plate_snapshot,
          });
        }
      }

      // Check if any active sessions belong to these bays
      const sessionBookingIds = (sessionsRes.data ?? [])
        .map((s) => s.booking_id)
        .filter((bookingId): bookingId is string => Boolean(bookingId));

      if (sessionBookingIds.length > 0) {
        const { data: sessionBookings } = await client
          .from("bookings")
          .select("id, slot_id, reference, status, start_at, end_at, plate_snapshot")
          .in("id", sessionBookingIds)
          .in("slot_id", slotIds);

        if (sessionBookings) {
          for (const b of sessionBookings) {
            occupiedSlotIdSet.add(b.slot_id);
            if (!activeBookingMap.has(b.slot_id)) {
              activeBookingMap.set(b.slot_id, {
                id: b.id,
                reference: b.reference,
                status: b.status,
                start_at: b.start_at,
                end_at: b.end_at,
                plate_snapshot: b.plate_snapshot,
              });
            }
          }
        }
      }
    } else {
      // Members determine slot availability safely via security-definer RPC
      const plusOneHourIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const { data: availRows, error: availError } = await client.rpc("slot_availability", {
        p_start: nowIso,
        p_end: plusOneHourIso,
        p_level: data.level === "All" ? null : data.level,
        p_zone: data.zone === "All" ? null : data.zone,
        p_slot_type: data.slot_type === "All" ? null : data.slot_type,
      });

      if (!availError && availRows) {
        for (const row of availRows) {
          if (!row.is_available) {
            occupiedSlotIdSet.add(row.slot_id);
          }
        }
      }
    }

    const enhancedSlots: ParkingSlotWithOccupancy[] = slots.map((slot) => {
      const booking = activeBookingMap.get(slot.id) ?? null;
      const isOccupied = occupiedSlotIdSet.has(slot.id) || Boolean(booking);
      return {
        ...slot,
        is_occupied: isOccupied,
        current_booking: booking,
      };
    });

    return {
      slots: enhancedSlots,
      totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages,
    };
  });

// ── 2. getFacilitySummary ────────────────────────────────────
// Aggregates counts per level and type, including current live occupancy.
// Validates auth before touching database (RLS enforced).
export const getFacilitySummary = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) {
    throw new Response("Request context missing", { status: 400 });
  }

  const { getCurrentUser } = await import("@/lib/auth.server");
  const authUser = await getCurrentUser(request);

  if (!authUser) {
    // Unauthenticated baseline: 150 bays, 12 EV, 10 accessible, all active
    return {
      totalSlots: 150,
      occupiedSlots: 0,
      reservedSlots: 0,
      availableSlots: 150,
      evReadySlots: 12,
      percentage: 100,
      levels: [],
      byLevel: {},
      byType: { standard: 128, ev: 12, accessible: 10 },
      byStatus: { active: 150, occupied: 0, maintenance: 0, blocked: 0 },
      updatedAt: new Date().toISOString(),
    };
  }

  const client = await getScopedClient(request);

  const now = new Date();
  const nowIso = now.toISOString();
  const plusOneHourIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  const [levelsRes, slotsRes, availRes, bookingsRes] = await Promise.all([
    client.from("parking_levels").select("*").order("sort_order", { ascending: true }),
    client.from("parking_slots").select("id, code, level_code, zone, slot_type, admin_status"),
    client.rpc("slot_availability", {
      p_start: nowIso,
      p_end: plusOneHourIso,
      p_level: null,
      p_zone: null,
      p_slot_type: null,
    }),
    client
      .from("bookings")
      .select("id, slot_id, status, start_at, end_at")
      .in("status", ["confirmed", "reserved", "active"])
      .lte("start_at", plusOneHourIso)
      .gte("end_at", nowIso),
  ]);

  if (levelsRes.error) {
    console.error("[getFacilitySummary] levels error:", levelsRes.error.message);
    throw new Response("Failed to fetch facility levels", { status: 500 });
  }
  if (slotsRes.error) {
    console.error("[getFacilitySummary] slots error:", slotsRes.error.message);
    throw new Response("Failed to fetch facility summary", { status: 500 });
  }

  const levels = levelsRes.data || [];
  const slots = slotsRes.data || [];
  const unavailableSet = new Set(
    (availRes.data || []).filter((r) => !r.is_available).map((r) => r.slot_id),
  );

  const bookings = bookingsRes.data || [];
  const activeBookingsSet = new Set(
    bookings.filter((b) => b.status === "active").map((b) => b.slot_id),
  );
  const reservedBookingsSet = new Set(
    bookings
      .filter((b) => b.status === "confirmed" || b.status === "reserved")
      .map((b) => b.slot_id),
  );

  const byLevel: Record<
    string,
    { total: number; active: number; occupied: number; maintenance: number; blocked: number }
  > = {};
  for (const lvl of levels) {
    byLevel[lvl.code] = { total: 0, active: 0, occupied: 0, maintenance: 0, blocked: 0 };
  }

  const byType = { standard: 0, ev: 0, accessible: 0 };
  const byStatus = { active: 0, occupied: 0, maintenance: 0, blocked: 0 };
  let evReadySlots = 0;

  for (const slot of slots) {
    const isUnavailable = unavailableSet.has(slot.id);
    const isOccupied =
      activeBookingsSet.has(slot.id) || (isUnavailable && !reservedBookingsSet.has(slot.id));
    const isReserved = reservedBookingsSet.has(slot.id);
    const isAvailable = slot.admin_status === "active" && !isUnavailable;

    const levelStats = byLevel[slot.level_code];
    if (levelStats) {
      levelStats.total += 1;
      if (slot.admin_status === "active") {
        if (isOccupied || isReserved) {
          levelStats.occupied += 1;
        } else {
          levelStats.active += 1;
        }
      } else if (slot.admin_status === "maintenance") {
        levelStats.maintenance += 1;
      } else if (slot.admin_status === "blocked") {
        levelStats.blocked += 1;
      }
    }

    if (slot.slot_type in byType) {
      byType[slot.slot_type as keyof typeof byType] += 1;
    }

    if (slot.admin_status === "active") {
      if (isOccupied) {
        byStatus.occupied += 1;
      } else {
        byStatus.active += 1;
      }
      if (slot.slot_type === "ev" && isAvailable) {
        evReadySlots += 1;
      }
    } else if (slot.admin_status in byStatus) {
      byStatus[slot.admin_status as keyof typeof byStatus] += 1;
    }
  }

  const totalSlots = slots.length;
  const occupiedSlots =
    activeBookingsSet.size > 0
      ? activeBookingsSet.size
      : unavailableSet.size - reservedBookingsSet.size > 0
        ? unavailableSet.size - reservedBookingsSet.size
        : unavailableSet.size;
  const reservedSlots = reservedBookingsSet.size;
  const availableSlots = slots.filter((s) => s.admin_status === "active" && !unavailableSet.has(s.id)).length;
  const percentage = totalSlots > 0 ? Math.round((availableSlots / totalSlots) * 100) : 0;

  return {
    totalSlots,
    occupiedSlots,
    reservedSlots,
    availableSlots,
    evReadySlots,
    percentage,
    levels,
    byLevel,
    byType,
    byStatus,
    updatedAt: nowIso,
  };
});

// ── 3. adminUpdateSlot ───────────────────────────────────────
// Allows admin to update ONLY admin_status, notes, and hourly_rate_paise.
// Strictly validated with Zod: cannot alter code, level_code, zone, bay_number, or slot_type.
const adminUpdateSlotSchema = z.object({
  id: z.string().uuid(),
  admin_status: z.enum(["active", "maintenance", "blocked"]).optional(),
  notes: z.string().max(500).nullable().optional(),
  hourly_rate_paise: z.number().int().min(0).max(100000).optional(),
});

export type AdminUpdateSlotInput = z.infer<typeof adminUpdateSlotSchema>;

export const adminUpdateSlot = createServerFn({ method: "POST" })
  .validator((params: AdminUpdateSlotInput) => adminUpdateSlotSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) {
      throw new Response("Request context missing", { status: 400 });
    }

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const updatePayload: Database["public"]["Tables"]["parking_slots"]["Update"] = {};
    if (data.admin_status !== undefined) {
      updatePayload.admin_status = data.admin_status;
    }
    if (data.notes !== undefined) {
      updatePayload.notes = data.notes;
    }
    if (data.hourly_rate_paise !== undefined) {
      updatePayload.hourly_rate_paise = data.hourly_rate_paise;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Response("No updatable fields provided", { status: 400 });
    }

    const { data: updated, error } = await client
      .from("parking_slots")
      .update(updatePayload)
      .eq("id", data.id)
      .select()
      .maybeSingle();

    if (error || !updated) {
      console.error("[adminUpdateSlot] Update error:", error?.message);
      throw new Response("Failed to update parking slot", { status: 500 });
    }

    return {
      success: true,
      slot: updated,
    };
  });
