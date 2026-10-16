import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CreditCard,
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Sparkles,
  ArrowDownRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { formatPaise, formatIstDateTime } from "@/lib/date-utils";
import { useAdminListPayments, type PaymentRow, type PaymentRefundRow } from "@/hooks/usePayments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payments")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Payments Ledger" },
      {
        name: "description",
        content:
          "Complete financial transactions ledger, GST breakdown, receipts, and refund audit.",
      },
    ],
  }),
  component: AdminPaymentsPage,
});

type PaymentWithRelations = PaymentRow & {
  bookings?: {
    reference: string;
    plate_snapshot: string;
    user_id: string;
    parking_slots?: {
      code: string;
      level_code: string;
    } | null;
  } | null;
  payment_refunds?: PaymentRefundRow[];
};

function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [status, setStatus] = useState<
    "all" | "succeeded" | "failed" | "refunded" | "partially_refunded"
  >("all");
  const [method, setMethod] = useState<"all" | "upi" | "card" | "netbanking" | "wallet">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithRelations | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminListPayments({
    page,
    pageSize,
    status,
    method,
    search: searchTerm,
  });

  const payments = (data?.payments ?? []) as PaymentWithRelations[];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const totals = data?.totals ?? {
    grossPaise: 0,
    refundPaise: 0,
    netPaise: 0,
    succeededCount: 0,
    failedCount: 0,
    totalTransactions: 0,
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedReceipt(text);
    setTimeout(() => setCopiedReceipt(null), 2000);
  };

  const handleResetFilters = () => {
    setStatus("all");
    setMethod("all");
    setSearchTerm("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Payments Ledger
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
              Live DB Records
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Audited financial transactions, GST tax receipts, payment methods, and automated
            refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Financial Totals Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Net Revenue</span>
            <div className="grid size-7 place-items-center rounded bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="font-mono text-2xl font-bold text-emerald-500">
              {formatPaise(totals.netPaise)}
            </strong>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total collected minus refunds issued
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Gross Processed</span>
            <div className="grid size-7 place-items-center rounded bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="font-mono text-2xl font-bold text-foreground">
              {formatPaise(totals.grossPaise)}
            </strong>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {totals.succeededCount} successful transactions
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Refunded</span>
            <div className="grid size-7 place-items-center rounded bg-amber-500/10 text-amber-500">
              <ArrowDownRight className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="font-mono text-2xl font-bold text-amber-500">
              {formatPaise(totals.refundPaise)}
            </strong>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Returned via cancellation tiers
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Attempts</span>
            <div className="grid size-7 place-items-center rounded bg-muted/40 text-muted-foreground">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="font-mono text-2xl font-bold text-foreground">
              {totals.totalTransactions}
            </strong>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {totals.failedCount} declined or timed out
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by receipt # (RC-...), booking ref, or vehicle plate..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            aria-label="Filter by payment status"
          >
            <option value="all">All Statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
          </select>

          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as typeof method);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            aria-label="Filter by payment method"
          >
            <option value="all">All Methods</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
          </select>

          {(status !== "all" || method !== "all" || searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-muted-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Table / Skeletons / Empty / Error */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-12">
              <span className="live-dot" />
              <span>Loading payment transactions from Postgres database...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="size-10 mx-auto text-destructive mb-3" />
            <h2 className="text-base font-semibold text-foreground">Failed to load transactions</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {error instanceof Error ? error.message : "Database connection error."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 gap-2">
              <RotateCcw className="size-3.5" /> Retry
            </Button>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center">
            <Receipt className="size-12 mx-auto text-muted-foreground/60 mb-3" />
            <h2 className="text-base font-semibold text-foreground">No payments found</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {searchTerm || status !== "all" || method !== "all"
                ? "No transactions match your search and filter criteria."
                : "No payments have been recorded yet. Book a space to create a test payment."}
            </p>
            {(searchTerm || status !== "all" || method !== "all") && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/20 font-mono uppercase tracking-wider text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Vehicle / Bay</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Processed Date</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => {
                  const receipt = p.receipt_number || "—";
                  const ref = p.bookings?.reference || "—";
                  const plate = p.bookings?.plate_snapshot || "—";
                  const slot = p.bookings?.parking_slots?.code || "—";

                  return (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{receipt}</span>
                          {p.receipt_number && (
                            <button
                              type="button"
                              onClick={() => copyText(p.receipt_number!)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copy receipt"
                            >
                              {copiedReceipt === p.receipt_number ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{ref}</td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-medium text-foreground">{plate}</span>
                        <span className="text-muted-foreground"> · Bay {slot}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="rounded bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-foreground">
                          {p.method}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-foreground">
                        {formatPaise(p.amount_paise)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium font-mono uppercase tracking-wider",
                            p.status === "succeeded" &&
                              "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                            p.status === "failed" &&
                              "border border-rose-500/30 bg-rose-500/10 text-rose-500",
                            p.status === "refunded" &&
                              "border border-blue-500/30 bg-blue-500/10 text-blue-500",
                            p.status === "partially_refunded" &&
                              "border border-amber-500/30 bg-amber-500/10 text-amber-500",
                          )}
                        >
                          {p.status === "succeeded" && <Check className="size-3" />}
                          {p.status === "failed" && <XCircle className="size-3" />}
                          {p.status === "refunded" && <RotateCcw className="size-3" />}
                          {p.status === "partially_refunded" && <RotateCcw className="size-3" />}
                          {p.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground font-mono">
                        {formatIstDateTime(p.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayment(p)}
                          className="h-7 px-2.5 text-xs text-primary hover:text-primary"
                        >
                          <Eye className="size-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && payments.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div>
              Showing{" "}
              <strong className="text-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)}
              </strong>{" "}
              of <strong className="text-foreground">{totalCount}</strong> transactions
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-2 font-mono text-[11px]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 px-2"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Transaction Details
                </h3>
                <p className="font-mono text-xs text-muted-foreground">ID: {selectedPayment.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              {/* Receipt & Status Info */}
              <div className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Receipt Number:</span>
                  <strong className="block font-mono text-sm text-foreground mt-0.5">
                    {selectedPayment.receipt_number || "None (Failed attempt)"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Gateway Provider:</span>
                  <span className="block font-mono text-xs text-foreground mt-0.5">
                    {selectedPayment.provider.toUpperCase()} (Ref:{" "}
                    {selectedPayment.provider_ref || "N/A"})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Booking Reference:</span>
                  <strong className="block font-mono text-xs text-primary mt-0.5">
                    {selectedPayment.bookings?.reference || "—"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Vehicle & Space:</span>
                  <span className="block font-mono text-xs text-foreground mt-0.5">
                    {selectedPayment.bookings?.plate_snapshot || "—"} · Bay{" "}
                    {selectedPayment.bookings?.parking_slots?.code || "—"}
                  </span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <h4 className="font-medium text-foreground border-b border-border/60 pb-1.5">
                  Financial Breakdown
                </h4>
                <div className="flex justify-between text-muted-foreground font-mono">
                  <span>Base Parking Charge:</span>
                  <span className="text-foreground">{formatPaise(selectedPayment.base_paise)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground font-mono">
                  <span>GST (18%):</span>
                  <span className="text-foreground">{formatPaise(selectedPayment.gst_paise)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2 font-mono font-bold text-foreground">
                  <span>Total Transaction Amount:</span>
                  <span className="text-sm text-emerald-500">
                    {formatPaise(selectedPayment.amount_paise)}
                  </span>
                </div>
              </div>

              {/* Status details */}
              {selectedPayment.failure_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <span className="font-semibold block">Gateway Error Reason:</span>
                  <p className="mt-0.5 font-mono">{selectedPayment.failure_reason}</p>
                </div>
              )}

              {/* Associated Refunds */}
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <h4 className="font-medium text-foreground">Cancellation Refunds</h4>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {selectedPayment.payment_refunds?.length ?? 0} refund record(s)
                  </span>
                </div>

                {selectedPayment.payment_refunds && selectedPayment.payment_refunds.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {selectedPayment.payment_refunds.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-start justify-between rounded border border-border/60 bg-surface p-2.5 font-mono text-[11px]"
                      >
                        <div>
                          <strong className="text-amber-500">
                            {formatPaise(ref.amount_paise)}
                          </strong>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{ref.reason}</p>
                        </div>
                        <span className="text-muted-foreground text-[10px]">
                          {formatIstDateTime(ref.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[11px] py-1">
                    No refunds have been processed for this transaction.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedPayment(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
