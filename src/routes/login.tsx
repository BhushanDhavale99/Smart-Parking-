import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/components/LoginPage";

/** Inline replay helper — prevents eagerly loading the 24 KB OpeningAnimation bundle */
function replayParkingIntro() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("parkgrid_seen_intro");
    window.dispatchEvent(new CustomEvent("replay-parking-intro"));
  }
}

type LoginSearch = {
  redirect?: string | undefined;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    return {
      redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
    };
  },
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          throw redirect({ to: "/admin", replace: true });
        }

        const target =
          search.redirect &&
          search.redirect.startsWith("/") &&
          !search.redirect.startsWith("//") &&
          !search.redirect.includes(":") &&
          !search.redirect.includes("\\")
            ? search.redirect
            : "/";
        throw redirect({ to: target, replace: true });
      }
    } catch (err) {
      if (
        err != null &&
        typeof err === "object" &&
        ("isRedirect" in err || "to" in err || "statusCode" in err)
      ) {
        throw err;
      }
      console.warn("Session check on login failed:", err);
    }
  },
  head: () => ({
    meta: [
      { title: "Sign In — ParkGrid One" },
      { name: "description", content: "Sign in or create your ParkGrid One account." },
      { property: "og:title", content: "Sign In — ParkGrid One" },
      { property: "og:description", content: "Sign in or create your ParkGrid One account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteLoginComponent,
});

function RouteLoginComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  // Rule 1: validate explicit redirect param — same-site relative paths only.
  const explicitRedirect =
    search.redirect &&
    search.redirect.startsWith("/") &&
    !search.redirect.startsWith("//") &&
    !search.redirect.includes(":")
      ? search.redirect
      : null;

  const handleLoginSuccess = async () => {
    sessionStorage.removeItem("parkgrid_seen_intro");
    replayParkingIntro();

    // Check if user is an admin; if so, send directly to /admin
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!error && profile?.role === "admin") {
          const adminTarget =
            explicitRedirect && explicitRedirect.startsWith("/admin") ? explicitRedirect : "/admin";
          navigate({ to: adminTarget });
          return;
        }
      }
    } catch {
      // Fall through to member redirect
    }

    // Explicit, validated redirect param for members.
    if (explicitRedirect) {
      navigate({ to: explicitRedirect });
      return;
    }

    // Member default destination.
    navigate({ to: "/" });
  };

  return <LoginPage standalone onLoginSuccess={handleLoginSuccess} />;
}
