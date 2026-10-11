import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAdminGuard } from "@/lib/auth-guard";
import { AdminLayout } from "@/components/admin/admin-layout";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Console" },
      {
        name: "description",
        content: "Facility administration, parking bay telemetry, and bookings.",
      },
      { property: "og:title", content: "Operations Console — ParkGrid One" },
      {
        property: "og:description",
        content: "Facility administration, parking bay telemetry, and bookings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
