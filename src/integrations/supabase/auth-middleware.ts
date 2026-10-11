// Server-side Supabase auth middleware.
// Validates the Bearer JWT sent by auth-attacher.ts on every serverFn RPC.
// Uses supabase.auth.getUser(token) — never getClaims() or getSession() —
// so validation always hits the Supabase Auth server (not a local JWT decode).
//
// Also exports:
//   requireUser()   — resolves the current user + their role from public.profiles
//   requireAdmin()  — throws HTTP 403 if the caller is not an admin
//
// Role is always read from public.profiles with the caller's own JWT so RLS
// is enforced. The client can NEVER influence the role value.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./types";

// ── Types ─────────────────────────────────────────────────────

export type UserRole = "member" | "admin" | "staff";

export interface AuthenticatedUser {
  user: User;
  userId: string;
  role: UserRole;
}

// ── Internal helpers ──────────────────────────────────────────

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/** Build a per-request Supabase client scoped to the caller's JWT. */
function buildUserClient(token: string) {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Add them to .env.local — see .env.example.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Fetch the caller's role from public.profiles using their own token.
 * RLS is enforced: users can only read their own row.
 * Returns 'member' if the profile row is missing or the query fails,
 * so a new user who hasn't been backfilled yet is never accidentally admin.
 */
async function fetchUserRole(
  supabase: ReturnType<typeof buildUserClient>,
  userId: string,
): Promise<UserRole> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      // Profile missing or query error — safe default
      return "member";
    }

    const role = data.role as string;
    if (role === "admin" || role === "staff" || role === "member") {
      return role;
    }
    // Unexpected value — default to member
    return "member";
  } catch {
    return "member";
  }
}

// ── Middleware ────────────────────────────────────────────────

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Add them to .env.local — see .env.example.`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    // Create a per-request client with the user's token in the Authorization
    // header. getUser() validates the token against the Supabase Auth server —
    // we do NOT decode the JWT locally or trust any client-supplied claims.
    const supabase = buildUserClient(token);

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error("Unauthorized: Invalid or expired session");
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        user: data.user,
      },
    });
  },
);

// ── Standalone helpers ────────────────────────────────────────

/**
 * requireUser(request)
 *
 * Validates the Bearer token in the given Request, then fetches the user's
 * role from public.profiles with the caller's own JWT (RLS enforced).
 *
 * Returns { user, userId, role }.
 * Throws if the token is missing, invalid, or expired.
 * Never trusts a role value sent by the client.
 */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or malformed authorization header");
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  const supabase = buildUserClient(token);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized: Invalid or expired session");
  }

  const role = await fetchUserRole(supabase, data.user.id);

  return {
    user: data.user,
    userId: data.user.id,
    role,
  };
}

/**
 * requireAdmin(request)
 *
 * Like requireUser() but also verifies the user's role is 'admin'.
 * Throws an error with status 403 if the user is authenticated but not admin.
 *
 * Usage: const { user, userId, role } = await requireAdmin(request);
 *
 * Do NOT wire this into any route yet — admin pages are out of scope for Stage 3.
 */
export async function requireAdmin(request: Request): Promise<AuthenticatedUser> {
  const authUser = await requireUser(request);

  if (authUser.role !== "admin") {
    // Use a plain Error; callers should map this to a 403 HTTP response.
    const err = new Error("Forbidden: Admin access required");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  return authUser;
}
