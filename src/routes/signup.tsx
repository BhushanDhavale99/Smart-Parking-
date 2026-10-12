import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/components/LoginPage";

function replayParkingIntro() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("parkgrid_seen_intro");
    window.dispatchEvent(new CustomEvent("replay-parking-intro"));
  }
}

type AuthSearch = {
  redirect?: string | undefined;
};

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
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
      console.warn("Session check on signup failed:", err);
    }
  },
  head: () => ({
    meta: [
      { title: "Sign Up — ParkGrid One" },
      { name: "description", content: "Create your ParkGrid One account." },
      { property: "og:title", content: "Sign Up — ParkGrid One" },
      { property: "og:description", content: "Create your ParkGrid One account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteSignupComponent,
});

function RouteSignupComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const explicitRedirect =
    search.redirect &&
    search.redirect.startsWith("/") &&
    !search.redirect.startsWith("//") &&
    !search.redirect.includes(":") &&
    !search.redirect.includes("\\")
      ? search.redirect
      : null;

  const handleLoginSuccess = async () => {
    sessionStorage.removeItem("parkgrid_seen_intro");
    replayParkingIntro();

    if (explicitRedirect) {
      navigate({ to: explicitRedirect });
      return;
    }

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
          navigate({ to: "/admin" });
          return;
        }
      }
    } catch {
      // Fall through to default
    }

    navigate({ to: "/" });
  };

  return <LoginPage standalone initialMode="signup" onLoginSuccess={handleLoginSuccess} />;
}
