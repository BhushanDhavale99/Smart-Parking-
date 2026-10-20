import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PricingSettingsRow = Database["public"]["Tables"]["pricing_settings"]["Row"];
export type AdminAuditLogRow = Database["public"]["Tables"]["admin_audit_log"]["Row"] & {
  actor?: {
    full_name: string | null;
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
    throw new Response("Service configuration missing", { status: 500 });
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false },
  });
}

function safeValidate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error("[settings.server validation error]:", JSON.stringify(result.error.issues));
    throw new Error("Invalid settings input.");
  }
  return result.data as z.output<T>;
}

// ── 1. adminGetSettings ──────────────────────────────────────────
export const adminGetSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireAdmin } = await import("@/lib/auth.server");
  await requireAdmin(request);

  const client = await getScopedClient(request);

  const { data: settings, error } = await client
    .from("pricing_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error || !settings) {
    console.error("[adminGetSettings] Query error:", error?.message);
    throw new Error("Failed to load facility system settings.");
  }

  return { settings };
});

// ── 2. adminUpdateSettings ──────────────────────────────────────
const adminUpdateSettingsSchema = z.object({
  gst_bps: z.number().int().min(0).max(2800, "GST must be between 0% and 28% (0-2800 bps)"),
  hold_minutes: z.number().int().min(5).max(30, "Hold duration must be 5-30 minutes"),
  min_hours: z.number().int().min(1).max(4, "Minimum booking hours must be 1-4"),
  max_hours: z.number().int().min(1).max(72, "Maximum booking hours must be 1-72"),
  max_advance_days: z.number().int().min(1).max(90, "Advance window must be 1-90 days"),
  refund_full_hours: z.number().int().min(0).max(48, "Full refund cutoff must be 0-48 hours"),
  refund_partial_minutes: z
    .number()
    .int()
    .min(0)
    .max(1440, "Partial refund cutoff must be 0-1440 mins"),
  partial_refund_bps: z.number().int().min(0).max(10000, "Partial refund must be 0-100%"),
  exit_grace_minutes: z.number().int().min(0).max(120, "Grace period must be 0-120 mins"),
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(300, "Reason cannot exceed 300 characters"),
});

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(adminUpdateSettingsSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    if (data.max_hours < data.min_hours) {
      throw new Error("Maximum booking hours cannot be less than minimum booking hours.");
    }

    const client = await getScopedClient(request);

    const { data: updated, error } = await client.rpc("admin_update_settings", {
      p_gst_bps: data.gst_bps,
      p_hold_minutes: data.hold_minutes,
      p_min_hours: data.min_hours,
      p_max_hours: data.max_hours,
      p_max_advance_days: data.max_advance_days,
      p_refund_full_hours: data.refund_full_hours,
      p_refund_partial_minutes: data.refund_partial_minutes,
      p_partial_refund_bps: data.partial_refund_bps,
      p_exit_grace_minutes: data.exit_grace_minutes,
      p_reason: data.reason,
    });

    if (error) {
      console.error("[adminUpdateSettings] RPC error:", error.message);
      throw new Error(error.message || "Failed to update system settings.");
    }

    return { settings: updated };
  });

// ── 3. adminListAuditLogs ───────────────────────────────────────
const adminListAuditLogsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(50),
});

export const adminListAuditLogs = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(adminListAuditLogsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: logs, error } = await client
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) {
      console.error("[adminListAuditLogs] Query error:", error.message);
      throw new Error("Failed to load audit logs.");
    }

    if (!logs || logs.length === 0) {
      return { logs: [] };
    }

    const actorIds = Array.from(new Set(logs.map((l) => l.actor_id).filter(Boolean)));
    const profileMap = new Map<string, { id: string; full_name: string | null }>();

    if (actorIds.length > 0) {
      const { data: profiles, error: profilesError } = await client
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);

      if (profilesError) {
        console.warn(
          "[adminListAuditLogs] Actor profiles query error:",
          profilesError.message,
        );
      }
      (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
    }

    const enriched: AdminAuditLogRow[] = logs.map((l) => ({
      ...l,
      actor: profileMap.get(l.actor_id)
        ? { full_name: profileMap.get(l.actor_id)!.full_name }
        : null,
    }));

    return { logs: enriched };
  });

// ── 4. adminGetSlotRates ─────────────────────────────────────────
export const adminGetSlotRates = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireAdmin } = await import("@/lib/auth.server");
  await requireAdmin(request);

  const client = await getScopedClient(request);
  const { data: rates, error } = await client.rpc("admin_get_slot_rates");

  if (error || !rates) {
    console.error("[adminGetSlotRates] Query error:", error?.message);
    throw new Error("Failed to load parking slot tariffs.");
  }

  return {
    rates: rates as {
      standard_rate_paise: number;
      ev_rate_paise: number;
      accessible_rate_paise: number;
    },
  };
});

// ── 5. adminUpdateSlotRates ──────────────────────────────────────
const adminUpdateSlotRatesSchema = z.object({
  standard_rate_paise: z.number().int().min(1000).max(100000),
  ev_rate_paise: z.number().int().min(1000).max(100000),
  accessible_rate_paise: z.number().int().min(1000).max(100000),
  reason: z.string().trim().min(5).max(300),
});

export const adminUpdateSlotRates = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(adminUpdateSlotRatesSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);
    const { data: updated, error } = await client.rpc("admin_update_slot_rates", {
      p_standard_rate_paise: data.standard_rate_paise,
      p_ev_rate_paise: data.ev_rate_paise,
      p_accessible_rate_paise: data.accessible_rate_paise,
      p_reason: data.reason,
    });

    if (error) {
      console.error("[adminUpdateSlotRates] RPC error:", error.message);
      throw new Error(error.message || "Failed to update slot rates.");
    }

    return { rates: updated };
  });

export interface AdminDashboardData {
  kpis: {
    bookings_today: number;
    revenue_today_paise: number;
    active_sessions_count: number;
    occupancy_percent: number;
    total_active_slots: number;
    occupied_slots: number;
  };
  revenue_last_7_days: Array<{
    date: string;
    label: string;
    net_paise: number;
  }>;
  recent_bookings: Array<{
    id: string;
    reference: string;
    slot_code: string;
    plate_snapshot: string;
    start_at: string;
    end_at: string;
    status: string;
    total_paise: number;
    created_at: string;
  }>;
  alerts: Array<{
    id: string;
    severity: "warning" | "error" | "info";
    title: string;
    description: string;
    link_tab: string;
  }>;
  generated_at: string;
}

// ── 6. adminGetDashboardStats ────────────────────────────────────
export const adminGetDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireAdmin } = await import("@/lib/auth.server");
  await requireAdmin(request);

  const client = await getScopedClient(request);
  const { data, error } = await client.rpc("admin_dashboard_stats");

  if (error || !data) {
    console.error("[adminGetDashboardStats] RPC error:", error?.message);
    throw new Error("Failed to load dashboard operational statistics.");
  }

  return { dashboard: data as unknown as AdminDashboardData };
});

