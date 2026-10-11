import { createFileRoute } from "@tanstack/react-router";
import { Settings, Shield, Sliders } from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { DemoBadge } from "@/components/admin/demo-badge";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Settings" },
      {
        name: "description",
        content: "Facility operating hours, ANPR camera thresholds, and security policies.",
      },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Settings
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Hardware barrier timing, grace periods, speed enforcement limits, and security
            notifications.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-12 text-center">
        <Settings className="size-12 mx-auto text-primary opacity-60 mb-3" />
        <h2 className="font-display text-lg font-semibold text-foreground">
          System Parameters Module Coming Soon
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Operational thresholds (15-minute departure grace period, 8 km/h facility speed limit, and
          ANPR optical recognition sensitivity) are active under facility baseline. Interactive
          adjustment controls will be unlocked in Phase 2.
        </p>
      </div>
    </div>
  );
}
