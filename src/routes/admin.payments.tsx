import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Clock, Sparkles } from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { DemoBadge } from "@/components/admin/demo-badge";

export const Route = createFileRoute("/admin/payments")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Payments" },
      {
        name: "description",
        content: "UPI, FASTag automated tolling, credit card gateway settlement, and invoices.",
      },
    ],
  }),
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Payments
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            UPI, FASTag automated tolling, credit card gateway settlement, and GST invoices.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-12 text-center">
        <CreditCard className="size-12 mx-auto text-primary opacity-60 mb-3" />
        <h2 className="font-display text-lg font-semibold text-foreground">
          Financial Ledger Module Coming Soon
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
          The payments gateway settlement reconciliation dashboard is under active deployment.
          Automated daily NEFT batch processing and GST tax invoice generation will appear here in
          Phase 2.
        </p>
      </div>
    </div>
  );
}
