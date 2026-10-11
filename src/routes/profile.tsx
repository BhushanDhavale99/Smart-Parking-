import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuthGuard } from "@/lib/auth-guard";

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ location }) => {
    await requireAuthGuard(location);
  },
  head: () => ({
    meta: [
      { title: "Profile & Settings — ParkGrid One" },
      {
        name: "description",
        content: "Manage your ParkGrid One profile, vehicles, payments, and security.",
      },
      { property: "og:title", content: "Profile & Settings — ParkGrid One" },
      {
        property: "og:description",
        content: "Manage your ParkGrid One profile, vehicles, payments, and security.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/app-pages"), "ProfilePage"),
});
