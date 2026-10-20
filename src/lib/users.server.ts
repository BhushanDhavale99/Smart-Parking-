import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: "member" | "admin" | "staff";
  createdAt: string;
  lastSignInAt: string | null;
  bookingCount: number;
  totalPaidPaise: number;
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
    console.error("[users.server validation error]:", JSON.stringify(result.error.issues));
    throw new Error("Invalid request parameters.");
  }
  return result.data as z.output<T>;
}

// ── 1. adminListUsers ───────────────────────────────────────────
const adminListUsersSchema = z.object({
  search: z.string().default(""),
  role: z.string().default("All"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const adminListUsers = createServerFn({ method: "GET" })
  .validator((params?: unknown) => safeValidate(adminListUsersSchema, params ?? {}))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const limit = Math.min(data.pageSize, 50);
    const offset = (data.page - 1) * limit;

    const { data: rows, error } = await client.rpc("admin_list_users", {
      p_search: data.search.trim() ? data.search.trim() : null,
      p_role: data.role !== "All" ? data.role : null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("[adminListUsers] RPC error:", error.message);
      throw new Error("Failed to load user accounts.");
    }

    const totalCount = rows && rows.length > 0 ? Number(rows[0]!.total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const users: AdminUserRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      phone: r.phone,
      role: (r.role as "member" | "admin" | "staff") ?? "member",
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      bookingCount: Number(r.booking_count ?? 0),
      totalPaidPaise: Number(r.total_paid_paise ?? 0),
    }));

    return {
      users,
      totalCount,
      totalPages,
      page: data.page,
      pageSize: limit,
    };
  });

// ── 2. adminSetUserRole ─────────────────────────────────────────
const adminSetUserRoleSchema = z.object({
  user_id: z.string().uuid("Invalid user identifier"),
  role: z.enum(["member", "staff", "admin"]),
  reason: z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(300, "Reason cannot exceed 300 characters"),
});

export const adminSetUserRole = createServerFn({ method: "POST" })
  .validator((params: unknown) => safeValidate(adminSetUserRoleSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    const { data: profile, error } = await client.rpc("admin_set_user_role", {
      p_user_id: data.user_id,
      p_role: data.role,
      p_reason: data.reason,
    });

    if (error) {
      console.error("[adminSetUserRole] RPC error:", error.message);
      throw new Error(error.message || "Failed to update user role.");
    }

    return { profile };
  });

// ── 3. adminGetUserDetail ───────────────────────────────────────
const adminGetUserDetailSchema = z.object({
  user_id: z.string().uuid(),
});

export const adminGetUserDetail = createServerFn({ method: "GET" })
  .validator((params: unknown) => safeValidate(adminGetUserDetailSchema, params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireAdmin } = await import("@/lib/auth.server");
    await requireAdmin(request);

    const client = await getScopedClient(request);

    // Fetch user profile
    const { data: profile, error: profileErr } = await client
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("User profile not found.");
    }

    // Fetch user bookings (recent 20) and registered vehicles concurrently
    const [bookingsRes, vehiclesRes] = await Promise.all([
      client
        .from("bookings")
        .select("*, parking_slots(code, level_code)")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(20),
      client
        .from("vehicles")
        .select("*")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false }),
    ]);

    if (bookingsRes.error) {
      console.error(
        "[adminGetUserDetail] User bookings query error:",
        bookingsRes.error.message,
      );
    }
    if (vehiclesRes.error) {
      console.error(
        "[adminGetUserDetail] User vehicles query error:",
        vehiclesRes.error.message,
      );
    }

    return {
      profile,
      bookings: bookingsRes.data ?? [],
      vehicles: vehiclesRes.data ?? [],
    };
  });
