import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/components/LoginPage";

type AuthSearch = {
  redirect?: string | undefined;
};

export const Route = createFileRoute("/forgot-password")({
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
      console.warn("Session check on forgot-password failed:", err);
    }
  },
  head: () => ({
    meta: [
      { title: "Forgot Password — ParkGrid One" },
      { name: "description", content: "Reset your ParkGrid One account password." },
      { property: "og:title", content: "Forgot Password — ParkGrid One" },
      { property: "og:description", content: "Reset your ParkGrid One account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteForgotPasswordComponent,
});

function RouteForgotPasswordComponent() {
  const navigate = useNavigate();
  return <LoginPage standalone initialForgot={true} onLoginSuccess={() => navigate({ to: "/" })} />;
}
