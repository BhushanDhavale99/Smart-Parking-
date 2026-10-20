import { createFileRoute, Navigate } from "@tanstack/react-router";
import { requireAdminGuard } from "@/lib/auth-guard";

export const Route = createFileRoute("/admin/pricing")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  component: () => <Navigate to="/admin/settings" replace />,
});
