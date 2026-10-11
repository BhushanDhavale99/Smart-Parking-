// Server-only auth helpers — never import this from client code or route files.
// Route files ship their component to the browser bundle; use dynamic imports
// inside serverFn handlers: const { requireUser } = await import("@/lib/auth.server");
//
// Role reading from public.profiles is added in Stage 3.
// For now, getCurrentUser returns role: "member" as a placeholder so the
// signature is stable and all callers won't need updating in Stage 3.
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Internal: build a per-request Supabase client authenticated as the caller.
// ---------------------------------------------------------------------------
function buildServerClient(token: string) {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Add them to .env.local — see .env.example.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Internal: extract Bearer token from a Request object.
// ---------------------------------------------------------------------------
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

// ---------------------------------------------------------------------------
// getCurrentUser
// Validates the Bearer token via supabase.auth.getUser() (server-side round-
// trip, never a local JWT decode) and returns the verified user + role.
//
// role is always read from public.profiles (Stage 3 wires this); until then
// it defaults to "member" so the TypeScript shape is stable.
// ---------------------------------------------------------------------------
export type AuthUser = {
  user: User;
  /** Role as stored in public.profiles. "member" placeholder until Stage 3. */
  role: "member" | "admin" | "staff";
};

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  const token = extractToken(request);
  if (!token) return null;

  const client = buildServerClient(token);

  // SECURITY: getUser() validates the JWT with the Supabase Auth server.
  // We never trust getSession() on the server — it only decodes locally.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  // Query public.profiles using caller's own token (RLS applies).
  // Missing row or query error defaults safely to "member".
  let role: AuthUser["role"] = "member";
  try {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[getCurrentUser/requireAdmin] Profiles role lookup failed:",
        profileError.message,
      );
    } else if (profile?.role) {
      if (profile.role === "admin" || profile.role === "staff" || profile.role === "member") {
        role = profile.role;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[getCurrentUser/requireAdmin] Error reading profiles role:", msg);
    role = "member";
  }

  return { user: data.user, role };
}

// ---------------------------------------------------------------------------
// requireUser
// Throws a 401 response if the caller is not authenticated.
// ---------------------------------------------------------------------------
export async function requireUser(request: Request): Promise<AuthUser> {
  const authUser = await getCurrentUser(request);
  if (!authUser) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return authUser;
}

// ---------------------------------------------------------------------------
// requireAdmin
// Throws a 401 / 403 response if the caller is not an admin.
// Reads role from public.profiles using the caller's own token (RLS applies).
// Missing row or lookup failure is treated as non-admin -> throws 403.
// ---------------------------------------------------------------------------
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const authUser = await requireUser(request);
  if (authUser.role !== "admin") {
    throw new Response("Forbidden: Admin access required", { status: 403 });
  }
  return authUser;
}
