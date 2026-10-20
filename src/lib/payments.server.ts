import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getPaymentProvider } from "@/lib/payments/provider";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentRefundRow = Database["public"]["Tables"]["payment_refunds"]["Row"];

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
    console.error("[payments.server validation error]:", JSON.stringify(result.error.issues));
    throw new Error("Something went wrong with this payment. Please go back and try again.");
  }
  return result.data as z.output<T>;
}

// ── 1. payBooking ─────────────────────────────────────────────
const payBookingSchema = z.object({
  booking_id: z.string().uuid(),
  method: z.enum(["upi", "card", "netbanking", "wallet"]),
  idempotency_key: z.string().uuid(),
  test_scenario: z.enum(["success", "decline", "insufficient_funds", "timeout"]).default("success"),
});

export const payBooking = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(payBookingSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    // Read configured payment mode from pricing_settings
    const { data: settings, error: settingsError } = await client
      .from("pricing_settings")
      .select("payment_mode")
      .eq("id", true)
      .maybeSingle();

    if (settingsError) {
      console.error("[payBooking] Failed reading pricing settings:", settingsError.message);
    }

    const mode = (settings?.payment_mode as "mock" | "razorpay" | undefined) ?? "mock";
    const provider = getPaymentProvider(mode);

    try {
      const result = await provider.createPayment(client, {
        bookingId: data.booking_id,
        method: data.method,
        idempotencyKey: data.idempotency_key,
        testScenario: data.test_scenario ?? "success",
      });

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[payBooking] Execution failed:", msg);
      if (
        msg.includes("hold has expired") ||
        msg.includes("expired") ||
        msg.includes("Reservation hold")
      ) {
        throw new Error("Reservation hold has expired. Please select a space again.");
      }
      if (msg.includes("already ended")) {
        throw new Error("Booking period has already ended. Please select a new time.");
      }
      if (msg.includes("Maximum payment attempts") || msg.includes("exceeded")) {
        throw new Error(
          "Maximum payment attempts reached for this reservation. Please choose another space.",
        );
      }
      if (msg.includes("declined")) {
        throw new Error("Card or transaction was declined by issuing bank.");
      }
      if (msg.includes("insufficient")) {
        throw new Error("Insufficient account balance or credit limit.");
      }
      if (msg.includes("timed out") || msg.includes("timeout")) {
        throw new Error("Payment gateway session timed out waiting for authorization.");
      }
      if (msg.includes("not found")) {
        throw new Error("Booking not found. Please select a space again.");
      }
      throw new Error(msg || "Payment processing failed. Please try again.");
    }
  });

// ── 2. getReceipt ─────────────────────────────────────────────
const getReceiptSchema = z
  .object({
    booking_id: z.string().uuid().optional(),
    payment_id: z.string().uuid().optional(),
    receipt_number: z.string().optional(),
  })
  .refine((d) => d.booking_id || d.payment_id || d.receipt_number, {
    message: "Must specify booking_id, payment_id, or receipt_number",
  });

export const getReceipt = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(getReceiptSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    await requireUser(request);

    const client = await getScopedClient(request);

    let query = client.from("payments").select(
      `
        *,
        bookings (
          id,
          reference,
          plate_snapshot,
          vehicle_type_snapshot,
          start_at,
          end_at,
          hours,
          hourly_rate_paise,
          base_paise,
          gst_paise,
          total_paise,
          status,
          payment_status,
          refund_paise,
          parking_slots (
            code,
            level_code,
            zone,
            slot_type
          )
        ),
        payment_refunds (*)
      `,
    );

    if (data.payment_id) {
      query = query.eq("id", data.payment_id);
    } else if (data.receipt_number) {
      query = query.eq("receipt_number", data.receipt_number);
    } else if (data.booking_id) {
      query = query.eq("booking_id", data.booking_id).order("created_at", { ascending: false });
    }

    const { data: payment, error } = await query.maybeSingle();

    if (error) {
      console.error("[getReceipt] Lookup error:", error.message);
      throw new Error("Unable to retrieve receipt.");
    }

    if (!payment) {
      throw new Error("Receipt not found.");
    }

    return { payment };
  });

// ── 3. listMyPayments ─────────────────────────────────────────
const listMyPaymentsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const listMyPayments = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(listMyPaymentsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    const {
      data: payments,
      error,
      count,
    } = await client
      .from("payments")
      .select(
        `
        *,
        bookings (
          reference,
          start_at,
          end_at,
          plate_snapshot,
          parking_slots (
            code,
            level_code
          )
        ),
        payment_refunds (*)
      `,
        { count: "exact" },
      )
      .eq("user_id", authUser.user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[listMyPayments] Error:", error.message);
      throw new Error("Failed to load your payment history.");
    }

    return {
      payments: payments ?? [],
      totalCount: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

// ── 4. adminListPayments ──────────────────────────────────────
const adminListPaymentsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(15),
  status: z.enum(["all", "succeeded", "failed", "refunded", "partially_refunded"]).default("all"),
  method: z.enum(["all", "upi", "card", "netbanking", "wallet"]).default("all"),
  search: z.string().optional().default(""),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const adminListPayments = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(adminListPaymentsSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    // Build paginated query
    let query = client.from("payments").select(
      `
        *,
        bookings (
          reference,
          plate_snapshot,
          user_id,
          parking_slots (
            code,
            level_code
          )
        ),
        payment_refunds (*)
      `,
      { count: "exact" },
    );

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.method && data.method !== "all") {
      query = query.eq("method", data.method);
    }

    if (data.dateFrom) {
      query = query.gte("created_at", data.dateFrom);
    }

    if (data.dateTo) {
      query = query.lte("created_at", data.dateTo);
    }

    const trimmedSearch = data.search?.trim();
    if (trimmedSearch) {
      query = query.or(
        `receipt_number.ilike.%${trimmedSearch}%,provider_ref.ilike.%${trimmedSearch}%`,
      );
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: payments, error, count } = await query;

    if (error) {
      console.error("[adminListPayments] Query error:", error.message);
      throw new Error("Failed to load payment transactions.");
    }

    // Compute financial totals across matching date range via DB aggregation RPC
    const { data: totalsData, error: totalsError } = await client.rpc("admin_payment_totals", {
      p_date_from: data.dateFrom || null,
      p_date_to: data.dateTo || null,
    });

    let totals = {
      grossPaise: 0,
      refundPaise: 0,
      netPaise: 0,
      succeededCount: 0,
      failedCount: 0,
      totalTransactions: count ?? 0,
    };

    if (!totalsError && totalsData && typeof totalsData === "object") {
      totals = totalsData as typeof totals;
    } else if (totalsError) {
      console.warn(
        "[adminListPayments] admin_payment_totals RPC error:",
        totalsError.message,
      );
    }

    return {
      payments: payments ?? [],
      totalCount: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      totals,
    };
  });

// ── 5. adminGetPayment ────────────────────────────────────────
const adminGetPaymentSchema = z.object({
  payment_id: z.string().uuid(),
});

export const adminGetPayment = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(adminGetPaymentSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: payment, error } = await client
      .from("payments")
      .select(
        `
        *,
        bookings (
          *,
          parking_slots (*),
          vehicles (*)
        ),
        payment_refunds (*)
      `,
      )
      .eq("id", data.payment_id)
      .maybeSingle();

    if (error || !payment) {
      console.error("[adminGetPayment] Lookup error:", error?.message);
      throw new Error("Payment not found.");
    }

    return { payment };
  });

// ── 6. adminRefundPayment ─────────────────────────────────────
const adminRefundPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  amount_paise: z.number().int().min(1, "Refund amount must be at least 1 paise"),
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(300, "Reason cannot exceed 300 characters"),
});

export const adminRefundPayment = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(adminRefundPaymentSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: refund, error } = await client.rpc("admin_refund_payment", {
      p_payment_id: data.payment_id,
      p_amount_paise: data.amount_paise,
      p_reason: data.reason,
    });

    if (error) {
      console.error("[adminRefundPayment] RPC error:", error.message);
      throw new Error(error.message || "Failed to process administrative refund.");
    }

    return { refund };
  });

// ── 7. adminRevenueReport ─────────────────────────────────────
const adminRevenueReportSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format (YYYY-MM-DD)"),
  group: z.enum(["day", "week", "month"]).default("day"),
});

export type RevenueReportPeriod = {
  period_label: string;
  gross_paise: number;
  refund_paise: number;
  net_paise: number;
  gst_paise: number;
  bookings_count: number;
  cancelled_count: number;
  overstay_paise: number;
};

export type RevenueReportTotals = {
  total_gross_paise: number;
  total_refund_paise: number;
  total_net_paise: number;
  total_gst_paise: number;
  total_bookings: number;
  total_cancelled: number;
  total_overstay_paise: number;
  average_booking_value_paise: number;
  cancellation_rate_bps: number;
};

export type RevenueReportBreakdown = {
  slot_type?: string;
  level_code?: string;
  method?: string;
  bookings_count?: number;
  count?: number;
  gross_paise: number;
};

export type RevenueReportData = {
  periods: RevenueReportPeriod[];
  totals: RevenueReportTotals;
  breakdown_by_slot_type: RevenueReportBreakdown[];
  breakdown_by_level: RevenueReportBreakdown[];
  breakdown_by_payment_method: RevenueReportBreakdown[];
};

export const adminRevenueReport = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(adminRevenueReportSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    // Validate max 366 days
    const fromDate = new Date(data.from);
    const toDate = new Date(data.to);
    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      throw new Error("Start date must be before or equal to end date.");
    }
    if (diffDays > 366) {
      throw new Error("Date range cannot exceed 366 days.");
    }

    const client = await getScopedClient(request);

    const { data: rawReport, error } = await client.rpc("admin_revenue_report", {
      p_from: data.from,
      p_to: data.to,
      p_group: data.group,
    });

    if (error) {
      console.error("[adminRevenueReport] RPC error:", error.message);
      throw new Error(error.message || "Failed to generate revenue report.");
    }

    return { report: rawReport as unknown as RevenueReportData };
  });
