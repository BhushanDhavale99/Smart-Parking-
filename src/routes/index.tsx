import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuthGuard } from "@/lib/auth-guard";
import { RootSplash } from "@/components/root-splash";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    await requireAuthGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid" },
      {
        name: "description",
        content:
          "Reserve secure smart parking with live availability and QR entry at ParkGrid One, BKC Mumbai.",
      },
      { property: "og:title", content: "ParkGrid — Smart Parking in BKC, Mumbai" },
      {
        property: "og:description",
        content:
          "Reserve secure smart parking with live availability and QR entry at ParkGrid One, BKC Mumbai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: RootSplash,
  component: lazyRouteComponent(() => import("@/components/app-pages"), "HomePage"),
});
