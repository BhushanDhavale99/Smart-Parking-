import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ParkingLevelRow = Database["public"]["Tables"]["parking_levels"]["Row"];
export type ParkingSlotRow = Database["public"]["Tables"]["parking_slots"]["Row"];

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
    await requireUser(request);

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

    const { data: slots, error, count } = await query;
    if (error) {
      console.error("[listSlots] Supabase error:", error.message);
      throw new Response("Failed to fetch parking slots", { status: 500 });
    }

    const totalCount = count ?? (slots?.length || 0);
    const totalPages = data.pageSize > 0 ? Math.ceil(totalCount / data.pageSize) || 1 : 1;

    return {
      slots: slots || [],
      totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages,
    };
  });

// ── 2. getFacilitySummary ────────────────────────────────────
// Aggregates counts per level and type.
// Requires valid authenticated user; executes query with caller's own token (RLS enforced).
export const getFacilitySummary = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) {
    throw new Response("Request context missing", { status: 400 });
  }

  const { requireUser } = await import("@/lib/auth.server");
  await requireUser(request);

  const client = await getScopedClient(request);

  const [levelsRes, slotsRes] = await Promise.all([
    client.from("parking_levels").select("*").order("sort_order", { ascending: true }),
    client.from("parking_slots").select("code, level_code, zone, slot_type, admin_status"),
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

  const byLevel: Record<
    string,
    { total: number; active: number; maintenance: number; blocked: number }
  > = {};
  for (const lvl of levels) {
    byLevel[lvl.code] = { total: 0, active: 0, maintenance: 0, blocked: 0 };
  }

  const byType = { standard: 0, ev: 0, accessible: 0 };
  const byStatus = { active: 0, maintenance: 0, blocked: 0 };

  for (const slot of slots) {
    const levelStats = byLevel[slot.level_code];
    if (levelStats) {
      levelStats.total += 1;
      if (slot.admin_status === "active") levelStats.active += 1;
      else if (slot.admin_status === "maintenance") levelStats.maintenance += 1;
      else if (slot.admin_status === "blocked") levelStats.blocked += 1;
    }

    if (slot.slot_type in byType) {
      byType[slot.slot_type as keyof typeof byType] += 1;
    }
    if (slot.admin_status in byStatus) {
      byStatus[slot.admin_status as keyof typeof byStatus] += 1;
    }
  }

  return {
    totalSlots: slots.length,
    levels,
    byLevel,
    byType,
    byStatus,
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
      console.error("[adminUpdateSlot] Update error:", error.message);
      throw new Response("Failed to update parking slot", { status: 500 });
    }

    return {
      success: true,
      slot: updated,
    };
  });
