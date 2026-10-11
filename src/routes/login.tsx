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
    const { supabase } = await import("@/integrations/supabase/client");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";
      throw redirect({ to: target });
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

    // Rule 1: explicit, validated redirect param — honour it for everyone.
    if (explicitRedirect) {
      navigate({ to: explicitRedirect });
      return;
    }

    // Rules 2 & 3: no redirect param — look up role server-side to pick destination.
    // Uses the signed-in user's own token so RLS applies.
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
      // Rule 3: any failure → treat as member and fall through to default.
    }

    // Member default destination.
    navigate({ to: "/" });
  };

  return <LoginPage standalone onLoginSuccess={handleLoginSuccess} />;
}
