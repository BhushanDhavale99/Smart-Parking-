import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CreditCard,
  Receipt,
  Search,
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
  AlertTriangle,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPaise, formatIstDateTime } from "@/lib/date-utils";
import {
  useAdminListPayments,
  useAdminRefundPayment,
  type PaymentRow,
  type PaymentRefundRow,
} from "@/hooks/usePayments";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payments")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Payments" },
      {
        name: "description",
        content: "Revenue",
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedPayment, setSelectedPayment] = useState<PaymentWithRelations | null>(null);
  const [refundTargetPayment, setRefundTargetPayment] = useState<PaymentWithRelations | null>(null);
  const [refundAmountRupees, setRefundAmountRupees] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminListPayments({
    page,
    pageSize,
    status,
    method,
    search: searchTerm,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const refundMutation = useAdminRefundPayment();

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
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // Remaining refundable calculation for target payment
  const remainingRefundablePaise = useMemo(() => {
    if (!refundTargetPayment) return 0;
    const refunds = refundTargetPayment.payment_refunds ?? [];
    const sumRefunds = refunds.reduce((acc, r) => acc + r.amount_paise, 0);
    return Math.max(0, refundTargetPayment.amount_paise - sumRefunds);
  }, [refundTargetPayment]);

  const handleOpenRefundModal = (p: PaymentWithRelations) => {
    setRefundTargetPayment(p);
    const refunds = p.payment_refunds ?? [];
    const sumRefunds = refunds.reduce((acc, r) => acc + r.amount_paise, 0);
    const remaining = Math.max(0, p.amount_paise - sumRefunds);
    setRefundAmountRupees((remaining / 100).toFixed(2));
    setRefundReason("");
  };

  const handleConfirmRefund = async () => {
    if (!refundTargetPayment) return;
    const paise = Math.round(parseFloat(refundAmountRupees) * 100);
    if (isNaN(paise) || paise < 1 || paise > remainingRefundablePaise) {
      toast.error(
        `Refund amount must be between ₹0.01 and ₹${(remainingRefundablePaise / 100).toFixed(2)}`,
      );
      return;
    }
    const trimmedReason = refundReason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 300) {
      toast.error("Reason must be between 5 and 300 characters.");
      return;
    }

    try {
      await refundMutation.mutateAsync({
        payment_id: refundTargetPayment.id,
        amount_paise: paise,
        reason: trimmedReason,
      });

      toast.success(`Refund of ${formatPaise(paise)} processed successfully.`);
      setRefundTargetPayment(null);
      setSelectedPayment(null);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute refund.";
      toast.error(msg);
    }
  };

  const canRefund = (p: PaymentWithRelations) => {
    if (p.status !== "succeeded" && p.status !== "partially_refunded") return false;
    const refunds = p.payment_refunds ?? [];
    const sumRefunds = refunds.reduce((acc, r) => acc + r.amount_paise, 0);
    return p.amount_paise - sumRefunds > 0;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Payments
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Revenue</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 h-8 text-xs"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Net Revenue</span>
            <div className="grid size-7 place-items-center rounded bg-emerald-500/10 text-emerald-500">
              <Sparkles className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-foreground">
                {formatPaise(totals.netPaise)}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Total collected minus refunds issued
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Gross Processed</span>
            <div className="grid size-7 place-items-center rounded bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-foreground">
                {formatPaise(totals.grossPaise)}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {totals.succeededCount} successful transactions
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Refunded</span>
            <div className="grid size-7 place-items-center rounded bg-amber-500/10 text-amber-500">
              <ArrowDownRight className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-amber-500">
                {formatPaise(totals.refundPaise)}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Returned via policy or manual refunds
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Attempts</span>
            <div className="grid size-7 place-items-center rounded bg-muted/40 text-muted-foreground">
              <Receipt className="size-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-3 space-y-1.5">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : (
            <div className="mt-3">
              <strong className="font-mono text-2xl font-bold text-foreground">
                {totals.totalTransactions}
              </strong>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {totals.failedCount} declined or timed out
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search receipt # (RC-...), booking ref, or vehicle plate..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
              <option value="card">Credit/Debit Card</option>
              <option value="netbanking">Net Banking</option>
              <option value="wallet">Digital Wallet</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground text-[11px] font-mono">From:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs bg-background w-32"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground text-[11px] font-mono">To:</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs bg-background w-32"
              />
            </div>

            {(searchTerm || status !== "all" || method !== "all" || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="size-8 mx-auto text-destructive" />
            <div className="text-sm font-semibold text-foreground">Failed to load transactions</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {error?.message || "Database connection error."}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 text-xs">
              Try again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-elevated/40 font-mono text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Receipt / Ref</th>
                  <th className="px-4 py-3">Booking / Space</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Gross (paise)</th>
                  <th className="px-4 py-3 text-right">Refunded</th>
                  <th className="px-4 py-3">Date (IST)</th>
                  <th className="px-4 py-3 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-4 w-full rounded bg-accent/40" />
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No payments matched your criteria.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const refunds = p.payment_refunds ?? [];
                    const sumRefunds = refunds.reduce((acc, r) => acc + r.amount_paise, 0);

                    return (
                      <tr key={p.id} className="hover:bg-accent/40 transition-colors">
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            {p.receipt_number || "Failed"}
                            {p.receipt_number && (
                              <button
                                type="button"
                                onClick={() => copyText(p.receipt_number!)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy receipt number"
                              >
                                {copiedReceipt === p.receipt_number ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            ID: {p.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-medium text-foreground">
                            {p.bookings?.reference || "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {p.bookings?.plate_snapshot || "—"}
                            {p.bookings?.parking_slots && ` · Bay ${p.bookings.parking_slots.code}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono capitalize text-muted-foreground">
                          {p.method}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase",
                              p.status === "succeeded" &&
                                "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                              p.status === "failed" &&
                                "border border-destructive/30 bg-destructive/10 text-destructive",
                              p.status === "refunded" &&
                                "border border-amber-500/30 bg-amber-500/10 text-amber-500",
                              p.status === "partially_refunded" &&
                                "border border-amber-500/30 bg-amber-500/10 text-amber-500",
                            )}
                          >
                            {p.status === "succeeded" && <CheckCircle2 className="size-2.5" />}
                            {p.status === "failed" && <XCircle className="size-2.5" />}
                            {(p.status === "refunded" || p.status === "partially_refunded") && (
                              <RotateCcw className="size-2.5" />
                            )}
                            {p.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground tabular-nums">
                          {formatPaise(p.amount_paise)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {sumRefunds > 0 ? (
                            <span className="font-bold text-amber-500">
                              {formatPaise(sumRefunds)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {formatIstDateTime(p.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canRefund(p) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px] font-mono text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                onClick={() => handleOpenRefundModal(p)}
                                title="Issue administrative refund"
                              >
                                <RotateCcw className="size-3 mr-1" />
                                Refund
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => setSelectedPayment(p)}
                              title="Inspect transaction"
                            >
                              <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="border-t border-border/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-mono">
          <div>
            Showing <strong className="text-foreground tabular-nums">{payments.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{totalCount}</strong> transactions
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 max-h-[90vh] overflow-y-auto">
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
                <h4 className="font-medium text-foreground border-b border-border/60 pb-1.5 font-bold">
                  Financial Breakdown
                </h4>
                <div className="flex justify-between text-muted-foreground font-mono">
                  <span>Base Parking Charge:</span>
                  <span className="text-foreground">{formatPaise(selectedPayment.base_paise)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground font-mono">
                  <span>GST:</span>
                  <span className="text-foreground">{formatPaise(selectedPayment.gst_paise)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-2 font-mono font-bold text-foreground">
                  <span>Total Transaction Amount:</span>
                  <span className="text-sm text-emerald-500">
                    {formatPaise(selectedPayment.amount_paise)}
                  </span>
                </div>
              </div>

              {/* Associated Refunds */}
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <h4 className="font-medium text-foreground font-bold">Refund History</h4>
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
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {ref.reason || "Manual refund"}
                          </p>
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

              <div className="flex justify-between items-center pt-2">
                {canRefund(selectedPayment) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-400 border-amber-500/40 hover:bg-amber-500/10 gap-1.5 h-8 text-xs font-mono"
                    onClick={() => {
                      handleOpenRefundModal(selectedPayment);
                      setSelectedPayment(null);
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                    Process Refund
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPayment(null)}
                  className="h-8 text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal Dialog */}
      <Dialog
        open={Boolean(refundTargetPayment)}
        onOpenChange={(open) => !open && setRefundTargetPayment(null)}
      >
        <DialogContent className="sm:max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display text-lg">
              <RotateCcw className="size-5 text-amber-400" />
              Administrative Refund
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Issue refund for receipt{" "}
              <strong className="text-foreground font-mono">
                {refundTargetPayment?.receipt_number || refundTargetPayment?.id}
              </strong>
              . All refunds are audit-logged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Refund Limits Card */}
            <div className="p-3 rounded-lg border border-border bg-background space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Charge:</span>
                <span className="text-foreground">
                  {formatPaise(refundTargetPayment?.amount_paise ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining Refundable:</span>
                <strong className="text-emerald-400">
                  {formatPaise(remainingRefundablePaise)}
                </strong>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground text-xs">
                Refund Amount (₹ INR) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={(remainingRefundablePaise / 100).toFixed(2)}
                value={refundAmountRupees}
                onChange={(e) => setRefundAmountRupees(e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs font-mono bg-background"
              />
              <span className="text-[10px] text-muted-foreground font-mono">
                Equivalent: {formatPaise(Math.round((parseFloat(refundAmountRupees) || 0) * 100))}
              </span>
            </div>

            {/* Reason input */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="font-medium text-foreground">
                  Reason for Refund <span className="text-destructive">*</span>
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {refundReason.trim().length}/300
                </span>
              </div>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason (5-300 characters, e.g. Customer overcharged due to barrier delay)..."
                className="text-xs bg-background min-h-[75px]"
                maxLength={300}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefundTargetPayment(null)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={
                refundReason.trim().length < 5 ||
                isNaN(parseFloat(refundAmountRupees)) ||
                parseFloat(refundAmountRupees) <= 0 ||
                Math.round(parseFloat(refundAmountRupees) * 100) > remainingRefundablePaise ||
                refundMutation.isPending
              }
              onClick={handleConfirmRefund}
              className="h-8 text-xs"
            >
              {refundMutation.isPending ? "Processing..." : "Confirm & Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
