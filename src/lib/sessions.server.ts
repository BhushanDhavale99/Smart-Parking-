import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ParkingSessionRow = Database["public"]["Tables"]["parking_sessions"]["Row"];
export type OverstayChargeRow = Database["public"]["Tables"]["overstay_charges"]["Row"];

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
function safeValidate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error("[sessions.server validation error]:", JSON.stringify(result.error.issues));
    throw new Error("Invalid request parameters.");
  }
  return result.data as z.output<T>;
}

// ── 1. getActiveSession ─────────────────────────────────────────
const getActiveSessionSchema = z.object({
  booking_id: z.string().uuid().optional().nullable(),
});

export const getActiveSession = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(getActiveSessionSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("get_active_session", {
      p_booking_id: data.booking_id ?? null,
    });

    if (error) {
      console.error("[getActiveSession] RPC error:", error.message);
      throw new Error("Failed to check active session.");
    }

    if (!rows || rows.length === 0) {
      return { session: null };
    }

    const s = rows[0]!;
    return {
      session: {
        sessionId: s.session_id,
        bookingId: s.booking_id,
        userId: s.user_id,
        startedAt: s.started_at,
        bookedEndAt: s.booked_end_at,
        endedAt: s.ended_at,
        status: s.status,
        autoEnded: s.auto_ended,
        endedByAdmin: s.ended_by_admin,
        durationMinutes: s.duration_minutes,
        isActive: s.is_active,
        elapsedSeconds: Number(s.elapsed_seconds ?? 0),
        secondsRemaining: Number(s.seconds_remaining ?? 0),
        overstaySeconds: Number(s.overstay_seconds ?? 0),
        overstayPaiseSoFar: Number(s.overstay_paise_so_far ?? 0),
        // Convenient prompt aliases
        elapsed: Number(s.elapsed_seconds ?? 0),
        remaining: Number(s.seconds_remaining ?? 0),
      },
    };
  });

// ── 2. endSession ───────────────────────────────────────────────
const endSessionSchema = z.object({
  session_id: z.string().uuid(),
});

export const endSession = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(endSessionSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("end_session", {
      p_session_id: data.session_id,
    });

    if (error) {
      console.error("[endSession] RPC error:", error.message);
      throw new Error(error.message || "Failed to end parking session.");
    }

    if (!rows || rows.length === 0) {
      throw new Error("Failed to finalize session.");
    }

    const r = rows[0]!;
    return {
      sessionId: r.session_id,
      bookingId: r.booking_id,
      endedAt: r.ended_at,
      durationMinutes: r.duration_minutes,
      overstayMinutes: r.overstay_minutes,
      overstayTotalPaise: r.overstay_total_paise,
    };
  });

// ── 3. listMySessions ───────────────────────────────────────────
const listMySessionsSchema = z.object({
  status: z.string().optional().nullable(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const listMySessions = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(listMySessionsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("list_my_sessions", {
      p_status: data.status && data.status !== "All" ? data.status : null,
      p_page: data.page,
      p_page_size: data.pageSize,
    });

    if (error) {
      console.error("[listMySessions] RPC error:", error.message);
      throw new Error("Failed to load parking sessions.");
    }

    const totalCount = rows && rows.length > 0 ? Number(rows[0]!.total_count) : 0;
    const totalPages = Math.ceil(totalCount / data.pageSize) || 1;

    const sessions = (rows ?? []).map((s) => ({
      sessionId: s.session_id,
      bookingId: s.booking_id,
      startedAt: s.started_at,
      bookedEndAt: s.booked_end_at,
      endedAt: s.ended_at,
      status: s.status,
      autoEnded: s.auto_ended,
      durationMinutes: s.duration_minutes,
      bookingReference: s.booking_reference,
      slotCode: s.slot_code,
      levelCode: s.level_code,
      plateSnapshot: s.plate_snapshot,
      overstayTotalPaise: Number(s.overstay_total_paise ?? 0),
    }));

    return {
      sessions,
      totalCount,
      totalPages,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

// ── 4. getSession ───────────────────────────────────────────────
const getSessionSchema = z.object({
  session_id: z.string().uuid(),
});

export const getSession = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(getSessionSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("get_session", {
      p_session_id: data.session_id,
    });

    if (error) {
      console.error("[getSession] RPC error:", error.message);
      throw new Error("Failed to retrieve parking session.");
    }

    if (!rows || rows.length === 0) {
      return { session: null };
    }

    const s = rows[0]!;
    return {
      session: {
        sessionId: s.session_id,
        bookingId: s.booking_id,
        userId: s.user_id,
        startedAt: s.started_at,
        bookedEndAt: s.booked_end_at,
        endedAt: s.ended_at,
        status: s.status,
        autoEnded: s.auto_ended,
        endedByAdmin: s.ended_by_admin,
        durationMinutes: s.duration_minutes,
        bookingReference: s.booking_reference,
        slotCode: s.slot_code,
        levelCode: s.level_code,
        plateSnapshot: s.plate_snapshot,
        overstayTotalPaise: Number(s.overstay_total_paise ?? 0),
      },
    };
  });

// ── 5. adminListSessions ───────────────────────────────────────
const adminListSessionsSchema = z.object({
  status: z.string().default("All"),
  search: z.string().default(""),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const adminListSessions = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(adminListSessionsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: rows, error } = await client.rpc("admin_list_sessions", {
      p_status: data.status && data.status !== "All" ? data.status : null,
      p_search: data.search.trim() ? data.search.trim() : null,
      p_page: data.page,
      p_page_size: Math.min(data.pageSize, 50),
    });

    if (error) {
      console.error("[adminListSessions] RPC error:", error.message);
      throw new Error("Failed to load admin parking sessions.");
    }

    const totalCount = rows && rows.length > 0 ? Number(rows[0]!.total_count) : 0;
    const totalPages = Math.ceil(totalCount / data.pageSize) || 1;

    const sessions = (rows ?? []).map((s) => ({
      sessionId: s.session_id,
      bookingId: s.booking_id,
      userId: s.user_id,
      startedAt: s.started_at,
      bookedEndAt: s.booked_end_at,
      endedAt: s.ended_at,
      status: s.status,
      autoEnded: s.auto_ended,
      endedByAdmin: s.ended_by_admin,
      durationMinutes: s.duration_minutes,
      bookingReference: s.booking_reference,
      slotCode: s.slot_code,
      levelCode: s.level_code,
      plateSnapshot: s.plate_snapshot,
      userFullName: s.user_full_name,
      overstayTotalPaise: Number(s.overstay_total_paise ?? 0),
    }));

    return {
      sessions,
      totalCount,
      totalPages,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

// ── 6. adminActiveSessions ─────────────────────────────────────
export type AdminActiveSessionRow = {
  sessionId: string;
  bookingId: string;
  bookingReference: string;
  slotCode: string;
  levelCode: string;
  plateSnapshot: string;
  userFullName: string | null;
  startedAt: string;
  bookedEndAt: string;
  overstayMinutes: number;
  overstayChargePaise: number;
  isOverstay: boolean;
};

export const adminActiveSessions = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireAdmin } = await import("@/lib/auth.server");
  await requireAdmin(request);

  const client = await getScopedClient(request);

  const { data: rows, error } = await client.rpc("admin_active_sessions");

  if (error) {
    console.error("[adminActiveSessions] RPC error:", error.message);
    throw new Error("Failed to load active sessions.");
  }

  const sessions: AdminActiveSessionRow[] = (rows ?? []).map((r) => ({
    sessionId: r.session_id,
    bookingId: r.booking_id,
    bookingReference: r.booking_reference,
    slotCode: r.slot_code,
    levelCode: r.level_code,
    plateSnapshot: r.plate_snapshot,
    userFullName: r.user_full_name,
    startedAt: r.started_at,
    bookedEndAt: r.booked_end_at,
    overstayMinutes: Number(r.overstay_minutes ?? 0),
    overstayChargePaise: Number(r.overstay_charge_paise ?? 0),
    isOverstay: Boolean(r.is_overstay),
  }));

  return { sessions };
});
