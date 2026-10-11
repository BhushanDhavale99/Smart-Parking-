import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuthGuard } from "@/lib/auth-guard";

export const Route = createFileRoute("/bookings")({
  beforeLoad: async ({ location }) => {
    await requireAuthGuard(location);
  },
  head: () => ({
    meta: [
      { title: "My Bookings — ParkGrid One" },
      {
        name: "description",
        content: "Review upcoming, active, completed, and cancelled ParkGrid One bookings.",
      },
      { property: "og:title", content: "My Bookings — ParkGrid One" },
      {
        property: "og:description",
        content: "Review upcoming, active, completed, and cancelled ParkGrid One bookings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/app-pages"), "BookingsPage"),
});
