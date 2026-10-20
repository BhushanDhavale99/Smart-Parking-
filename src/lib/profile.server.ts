import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ProfileData = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: "member" | "admin" | "staff";
  created_at: string;
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

// ── Phone Normalization Helper ──
export function normalizeIndianPhone(input: string): string {
  const cleaned = input.trim().replace(/[\s-]/g, "");
  const match = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!match || !match[1]) {
    throw new Error("Phone must be a valid 10-digit Indian mobile number starting with 6-9.");
  }
  return `+91${match[1]}`;
}

// ── 1. getProfile ─────────────────────────────────────────────
export const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireUser } = await import("@/lib/auth.server");
  const authUser = await requireUser(request);

  const client = await getScopedClient(request);

  const { data: profile, error } = await client
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("id", authUser.user.id)
    .maybeSingle();

  if (error) {
    console.error("[getProfile] Error loading profile:", error.message);
    throw new Error("Failed to load profile details.");
  }

  const roleValue =
    profile?.role === "admin" || profile?.role === "staff" ? profile.role : "member";

  return {
    profile: {
      id: authUser.user.id,
      email: authUser.user.email ?? "",
      full_name:
        profile?.full_name ??
        (authUser.user.user_metadata?.["full_name"] as string | undefined) ??
        null,
      phone: profile?.phone ?? null,
      role: roleValue,
      created_at: profile?.created_at ?? authUser.user.created_at,
    } as ProfileData,
  };
});

// ── 2. updateProfile ──────────────────────────────────────────
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Name must be between 2 and 80 characters")
    .max(80, "Name must be between 2 and 80 characters"),
  phone: z
    .string()
    .trim()
    .refine((val) => {
      if (!val) return true;
      const cleaned = val.replace(/[\s-]/g, "");
      return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned);
    }, "Phone must be a valid 10-digit Indian mobile number starting with 6-9")
    .transform((val) => {
      if (!val) return null;
      const cleaned = val.replace(/[\s-]/g, "");
      const match = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
      return match && match[1] ? `+91${match[1]}` : null;
    })
    .nullable()
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateProfile = createServerFn({ method: "POST" })
  .validator((params: unknown) => updateProfileSchema.parse(params))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Response("Request context missing", { status: 400 });

    const { requireUser } = await import("@/lib/auth.server");
    const authUser = await requireUser(request);

    const client = await getScopedClient(request);

    // Explicitly update only full_name and phone on caller's own row
    // Any client-sent id, role, or avatar_url is omitted/ignored
    const { data: updated, error } = await client
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
      })
      .eq("id", authUser.user.id)
      .select("id, full_name, phone, role, created_at")
      .single();

    if (error || !updated) {
      console.error("[updateProfile] Error updating profile:", error?.message);
      throw new Error("Failed to update profile. Please check the details and try again.");
    }

    const roleValue =
      updated.role === "admin" || updated.role === "staff" ? updated.role : "member";

    return {
      profile: {
        id: updated.id,
        email: authUser.user.email ?? "",
        full_name: updated.full_name,
        phone: updated.phone,
        role: roleValue,
        created_at: updated.created_at,
      } as ProfileData,
    };
  });

// ── 3. listRecentBookings (Top 5 for Profile Bookings Tab) ────
export const listRecentBookings = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request) throw new Response("Request context missing", { status: 400 });

  const { requireUser } = await import("@/lib/auth.server");
  const authUser = await requireUser(request);

  const client = await getScopedClient(request);

  const { data: bookings, error } = await client
    .from("bookings")
    .select(
      "id, reference, status, start_at, end_at, total_paise, parking_slots(code, zone, level_code)",
    )
    .eq("user_id", authUser.user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[listRecentBookings] Error:", error.message);
    throw new Error("Failed to load recent bookings.");
  }

  return { bookings: bookings ?? [] };
});
