import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { requireAdminGuard } from "@/lib/auth-guard";

export const Route = createFileRoute("/admin/knowledge")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Knowledge Base" },
      {
        name: "description",
        content:
          "Manage the documents and vector chunks used by the ParkGrid One parking assistant.",
      },
      { property: "og:title", content: "AI Knowledge Base — Operations Console" },
      {
        property: "og:description",
        content:
          "Manage the documents and vector chunks used by the ParkGrid One parking assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/app-pages"), "KnowledgePage"),
});
