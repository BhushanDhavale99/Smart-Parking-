// Client-side route guard helper.
// Called from beforeLoad in protected routes to redirect unauthenticated
// visitors to /login with a ?redirect= param so they return to the right page.
//
// IMPORTANT: This uses supabase.auth.getSession() intentionally — on the
// *client*, getSession() is fine because we only use it to decide whether
// to show the page or redirect to /login. Actual data operations are always
// protected server-side via requireUser() in auth.server.ts.
import { redirect } from "@tanstack/react-router";

function sanitizeRedirectTarget(pathname: string, fallback = "/"): string {
  if (
    typeof pathname === "string" &&
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !pathname.includes(":") &&
    !pathname.includes("\\")
  ) {
    return pathname;
  }
  return fallback;
}

export async function requireAuthGuard(location: { pathname: string }) {
  // During SSR there is no window/localStorage. The SiteShell client gate
  // handles the redirect after hydration; skip here to avoid SSR errors.
  if (typeof window === "undefined") return;

  const { supabase } = await import("@/integrations/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Only allow same-origin relative redirect targets.
    const redirectTo = sanitizeRedirectTarget(location.pathname, "/");
    throw redirect(
      redirectTo === "/" ? { to: "/login" } : { to: "/login", search: { redirect: redirectTo } },
    );
  }
}

export async function requireAdminGuard(location: { pathname: string }) {
  if (typeof window === "undefined") return;

  const { supabase } = await import("@/integrations/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Unauthenticated visitors go to /login with sanitized relative redirect target
    const redirectTo = sanitizeRedirectTarget(location.pathname, "/admin");
    throw redirect({
      to: "/login",
      search: { redirect: redirectTo },
    });
  }

  // Authenticated visitors: verify role is 'admin' from public.profiles
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profile || profile.role !== "admin") {
      // Logged-in non-admins are redirected away to home
      throw redirect({
        to: "/",
      });
    }
  } catch (err) {
    // Re-throw redirect if TanStack Router thrown redirect
    if (
      err != null &&
      typeof err === "object" &&
      ("isRedirect" in err || "to" in err || "statusCode" in err)
    ) {
      throw err;
    }
    // Any unexpected profile fetch failure defaults to non-admin: redirect home
    throw redirect({
      to: "/",
    });
  }
}
