import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuthGuard } from "@/lib/auth-guard";

export const Route = createFileRoute("/confirmation")({
  beforeLoad: async ({ location }) => {
    await requireAuthGuard(location);
  },
  head: () => ({
    meta: [
      { title: "Booking Confirmed — ParkGrid One" },
      { name: "description", content: "Your ParkGrid One parking booking and QR entry pass." },
      { property: "og:title", content: "Booking Confirmed — ParkGrid One" },
      {
        property: "og:description",
        content: "Your ParkGrid One parking booking and QR entry pass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/app-pages"), "ConfirmationPage"),
});
