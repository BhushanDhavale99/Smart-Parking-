import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
export type PricingSettingsRow = Database["public"]["Tables"]["pricing_settings"]["Row"];

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
    throw new Response("Service configuration missing", { status: 500 });
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false },
  });
}

// ── Validation and Identity Helpers ───────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeValidate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error("[bookings.server validation error]:", JSON.stringify(result.error.issues));
    throw new Error("Something went wrong with this booking. Please go back and try again.");
  }
  return result.data as z.output<T>;
}

async function resolveSlotUuid(
  client: Awaited<ReturnType<typeof getScopedClient>>,
  slotIdOrCode: string,
): Promise<string> {
  if (UUID_REGEX.test(slotIdOrCode)) {
    return slotIdOrCode;
  }
  // Lookup database UUID by slot code (e.g. "B2-01", "G1-A01")
  const { data, error } = await client
    .from("parking_slots")
    .select("id")
    .eq("code", slotIdOrCode)
    .maybeSingle();

  if (error || !data) {
    console.error("[resolveSlotUuid] Unable to resolve slot code:", slotIdOrCode, error?.message);
    throw new Error("Selected parking bay could not be found. Please select a space again.");
  }
  return data.id;
}

// ── 1. getAvailability ───────────────────────────────────────
const availabilitySchema = z.object({
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  level: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  slot_type: z.string().optional().nullable(),
});

export const getAvailability = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(availabilitySchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("slot_availability", {
      p_start: data.start_at,
      p_end: data.end_at,
      p_level: data.level || null,
      p_zone: data.zone || null,
      p_slot_type: data.slot_type || null,
    });

    if (error) {
      console.error("[getAvailability] RPC error:", error.message);
      throw new Error("Unable to check parking space availability.");
    }

    return { availability: rows ?? [] };
  });

// ── 2. quoteBooking ──────────────────────────────────────────
const quoteSchema = z.object({
  slot_id: z.string().min(1),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
});

export const quoteBooking = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(quoteSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);
    const resolvedSlotId = await resolveSlotUuid(client, data.slot_id);

    const { data: rows, error } = await client.rpc("quote_booking", {
      p_slot_id: resolvedSlotId,
      p_start: data.start_at,
      p_end: data.end_at,
    });

    if (error || !rows || rows.length === 0) {
      console.error("[quoteBooking] RPC error:", error?.message);
      throw new Error("Failed to compute booking pricing quote.");
    }

    const first = rows[0];
    if (!first) throw new Error("Pricing quote calculation failed.");

    return {
      quote: {
        hours: first.hours,
        hourly_rate_paise: first.hourly_rate_paise,
        base_paise: first.base_paise,
        gst_paise: first.gst_paise,
        total_paise: first.total_paise,
      },
    };
  });

// ── 3. createBooking ─────────────────────────────────────────
const createBookingSchema = z.object({
  slot_id: z.string().min(1),
  vehicle_id: z.string().uuid(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
});

export const createBooking = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(createBookingSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);
    const resolvedSlotId = await resolveSlotUuid(client, data.slot_id);

    const { data: booking, error } = await client.rpc("create_booking", {
      p_slot_id: resolvedSlotId,
      p_vehicle_id: data.vehicle_id,
      p_start: data.start_at,
      p_end: data.end_at,
    });

    if (error) {
      console.error("[createBooking] RPC error:", error.code, error.message);
      if (
        error.code === "P0003" ||
        error.code === "23P01" ||
        error.message.includes("just taken")
      ) {
        throw new Error("This slot was just taken for that time. Please pick another space.");
      }
      if (error.message.includes("in the past")) {
        throw new Error(
          "Booking start time cannot be in the past. Please select an upcoming arrival time.",
        );
      }
      if (error.message.includes("advance")) {
        throw new Error("Booking cannot be made so far in advance.");
      }
      if (error.message.includes("aligned")) {
        throw new Error("Booking start time must be aligned to a 15-minute mark.");
      }
      if (error.message.includes("duration")) {
        throw new Error("Selected booking duration is not permitted.");
      }
      throw new Error(error.message || "Failed to reserve parking space. Please try again.");
    }

    return { booking };
  });

// ── 5. listMyBookings ────────────────────────────────────────
const listMyBookingsSchema = z.object({
  statusTab: z.enum(["Upcoming", "Active", "Completed", "Cancelled"]).default("Upcoming"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const listMyBookings = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(listMyBookingsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);
    await client.rpc("expire_stale_holds");
    await client.rpc("expire_unused_bookings");

    const nowIso = new Date().toISOString();
    let query = client
      .from("bookings")
      .select(
        "*, parking_slots(id, code, level_code, zone, slot_type), vehicles(id, plate_number, vehicle_type, make, model)",
        { count: "exact" },
      )
      .eq("user_id", authUser.user.id);

    if (data.statusTab === "Upcoming") {
      query = query
        .in("status", ["reserved", "confirmed"])
        .gte("start_at", nowIso)
        .order("start_at", { ascending: true });
    } else if (data.statusTab === "Active") {
      query = query
        .in("status", ["confirmed", "active"])
        .lte("start_at", nowIso)
        .gte("end_at", nowIso)
        .order("end_at", { ascending: true });
    } else if (data.statusTab === "Completed") {
      query = query.in("status", ["completed", "no_show"]).order("end_at", { ascending: false });
    } else {
      // Cancelled
      query = query
        .in("status", ["cancelled", "expired"])
        .order("created_at", { ascending: false });
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    query = query.range(from, to);

    const { data: bookings, count, error } = await query;

    if (error) {
      console.error("[listMyBookings] Query error:", error.message);
      throw new Error("Unable to retrieve your bookings.");
    }

    return {
      bookings: bookings ?? [],
      totalCount: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

// ── 6. getBooking ────────────────────────────────────────────
const getBookingSchema = z.object({
  id: z.string().uuid().optional(),
  reference: z.string().optional(),
});

export const getBooking = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(getBookingSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    let query = client
      .from("bookings")
      .select(
        "*, parking_slots(id, code, level_code, zone, slot_type), vehicles(id, plate_number, vehicle_type, make, model)",
      );

    if (data.id) {
      query = query.eq("id", data.id);
    } else if (data.reference) {
      query = query.eq("reference", data.reference);
    } else {
      throw new Error("Booking identifier required.");
    }

    const { data: booking, error } = await query.maybeSingle();
    if (error || !booking) {
      console.error("[getBooking] Error:", error?.message);
      throw new Error("Booking not found.");
    }

    return { booking };
  });

// ── 7. getCancellationPreview ────────────────────────────────
const previewSchema = z.object({
  booking_id: z.string().uuid(),
});

export const getCancellationPreview = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(previewSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("cancellation_preview", {
      p_booking_id: data.booking_id,
    });

    if (error || !rows || rows.length === 0) {
      console.error("[getCancellationPreview] RPC error details:", {
        message: error?.message,
        code: error?.code,
        hint: error?.hint,
      });
      throw new Error(error?.message || "Unable to calculate refund preview.");
    }

    const preview = rows[0];
    if (!preview) throw new Error("Refund calculation failed.");

    return {
      preview: {
        booking_id: preview.booking_id,
        total_paise: preview.total_paise,
        refund_paise: preview.refund_paise,
        refund_percentage: preview.refund_percentage,
        payment_status: preview.payment_status,
      },
    };
  });

// ── 8. cancelBooking ─────────────────────────────────────────
const cancelSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const cancelBooking = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(cancelSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);
    await client.rpc("expire_unused_bookings");

    const { data: booking, error } = await client.rpc("cancel_booking", {
      p_booking_id: data.booking_id,
      p_reason: data.reason || null,
    });

    if (error || !booking) {
      console.error("[cancelBooking] RPC error details:", {
        message: error?.message,
        code: error?.code,
        hint: error?.hint,
        details: error?.details,
      });

      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("already started") || msg.includes("start_at") || msg.includes("past")) {
        throw new Error("This booking has already started and cannot be cancelled.");
      }
      if (msg.includes("ongoing") || msg.includes("session")) {
        throw new Error("This booking has an active parking session and cannot be cancelled.");
      }
      if (
        msg.includes("already completed") ||
        msg.includes("already cancelled") ||
        msg.includes("already expired") ||
        msg.includes("already no_show") ||
        msg.includes("cannot cancel")
      ) {
        throw new Error("This booking cannot be cancelled because it is no longer active.");
      }
      if (msg.includes("access denied") || msg.includes("unauthorized")) {
        throw new Error("You do not have permission to cancel this booking.");
      }
      if (msg.includes("booking not found")) {
        throw new Error("Booking not found.");
      }
      throw new Error("This booking cannot be cancelled.");
    }

    return { booking };
  });

// ── 9. adminListBookings ─────────────────────────────────────
const adminListBookingsSchema = z.object({
  status: z.string().default("All"),
  payment_status: z.string().default("All"),
  search: z.string().default(""),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const adminListBookings = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(adminListBookingsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);
    await client.rpc("expire_stale_holds");
    await client.rpc("expire_unused_bookings");

    let query = client
      .from("bookings")
      .select(
        "*, parking_slots(id, code, level_code, zone, slot_type), vehicles(id, plate_number, vehicle_type, make, model), profiles(full_name, phone)",
        { count: "exact" },
      );

    if (data.status !== "All") {
      query = query.eq("status", data.status as BookingRow["status"]);
    }

    if (data.payment_status !== "All") {
      query = query.eq("payment_status", data.payment_status as BookingRow["payment_status"]);
    }

    if (data.dateFrom) {
      query = query.gte("created_at", data.dateFrom);
    }

    if (data.dateTo) {
      query = query.lte("created_at", data.dateTo);
    }

    if (data.search.trim()) {
      const q = data.search.trim();
      query = query.or(`reference.ilike.%${q}%,plate_snapshot.ilike.%${q}%`);
    }

    query = query.order("created_at", { ascending: false });

    const limit = Math.min(data.pageSize, 50);
    const from = (data.page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: bookings, count, error } = await query;

    if (error) {
      console.error("[adminListBookings] Error:", error.message);
      throw new Error("Failed to load admin bookings.");
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      bookings: bookings ?? [],
      totalCount,
      totalPages,
      page: data.page,
      pageSize: limit,
    };
  });

// ── 10. adminGetBooking ───────────────────────────────────────
const adminGetBookingSchema = z.object({
  booking_id: z.string().uuid(),
});

export const adminGetBooking = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(adminGetBookingSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: booking, error } = await client
      .from("bookings")
      .select(
        `
        *,
        parking_slots (*),
        vehicles (*),
        profiles (id, full_name, phone, role),
        payments (*),
        payment_refunds (*),
        parking_sessions (*)
      `,
      )
      .eq("id", data.booking_id)
      .maybeSingle();

    if (error || !booking) {
      console.error("[adminGetBooking] Error:", error?.message);
      throw new Error("Booking not found.");
    }

    return { booking };
  });

// ── 11. adminOverrideBooking ──────────────────────────────────
const adminOverrideBookingSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.enum(["cancel_full_refund", "cancel_by_policy", "cancel_no_refund", "mark_no_show"]),
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(300, "Reason cannot exceed 300 characters"),
});

export const adminOverrideBooking = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(adminOverrideBookingSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: updatedBooking, error } = await client.rpc("admin_override_booking", {
      p_booking_id: data.booking_id,
      p_action: data.action,
      p_reason: data.reason,
    });

    if (error) {
      console.error("[adminOverrideBooking] RPC error:", error.message);
      throw new Error(error.message || "Failed to override booking.");
    }

    return { booking: updatedBooking };
  });
