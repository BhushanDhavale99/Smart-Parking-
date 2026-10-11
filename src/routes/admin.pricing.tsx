import { createFileRoute } from "@tanstack/react-router";
import { Tag, Clock, TrendingUp } from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { DemoBadge } from "@/components/admin/demo-badge";

export const Route = createFileRoute("/admin/pricing")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Pricing" },
      {
        name: "description",
        content: "Configure hourly tariffs, surge multipliers, and EV charging rates.",
      },
    ],
  }),
  component: AdminPricingPage,
});

function AdminPricingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Pricing rules
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Peak hours surge multipliers, weekend event tariffs, and EV kWh electricity rates.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-12 text-center">
        <Tag className="size-12 mx-auto text-primary opacity-60 mb-3" />
        <h2 className="font-display text-lg font-semibold text-foreground">
          Tariff Configuration Engine Coming Soon
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          Dynamic tariff rules based on live occupancy brackets (e.g. 1.25x surge when facility
          occupancy exceeds 90%) are currently managed via automated back-end policies. A full UI
          editor will be activated in Phase 2.
        </p>
      </div>
    </div>
  );
}
