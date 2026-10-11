import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAuthGuard } from "@/lib/auth-guard";

export const Route = createFileRoute("/vehicles")({
  beforeLoad: async ({ location }) => {
    await requireAuthGuard(location);
  },
  head: () => ({
    meta: [
      { title: "Choose Vehicle — ParkGrid One" },
      { name: "description", content: "Select a saved vehicle for your ParkGrid One reservation." },
      { property: "og:title", content: "Choose Vehicle — ParkGrid One" },
      {
        property: "og:description",
        content: "Select a saved vehicle for your ParkGrid One reservation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/app-pages"), "VehiclesPage"),
});
