import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck,
  Search,
  Eye,
  RefreshCw,
  AlertCircle,
  Inbox,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import {
  useAdminBookings,
  useAdminBookingDetail,
  useAdminOverrideBooking,
  type AdminBookingRow,
} from "@/hooks/useBookings";
import { formatIstDateTime, formatPaise } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bookings")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Bookings" },
      {
        name: "description",
        content: "Track parking bay reservations, check-in status, and ticketing.",
      },
    ],
  }),
  component: AdminBookingsPage,
});

type OverrideAction =
  "cancel_full_refund" | "cancel_by_policy" | "cancel_no_refund" | "mark_no_show";

function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [overrideModalBooking, setOverrideModalBooking] = useState<AdminBookingRow | null>(null);
  const [overrideAction, setOverrideAction] = useState<OverrideAction>("cancel_by_policy");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminBookings({
    status: statusFilter === "All" ? undefined : statusFilter.toLowerCase(),
    payment_status: paymentStatusFilter === "All" ? undefined : paymentStatusFilter.toLowerCase(),
    search: searchQuery.trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize,
  });

  const { data: bookingDetail, isLoading: isLoadingDetail } =
    useAdminBookingDetail(selectedBookingId);
  const overrideMutation = useAdminOverrideBooking();

  const bookings = data?.bookings ?? [];
  const total = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? (Math.ceil(total / pageSize) || 1);

  const handleRefresh = () => {
    refetch();
  };

  // Calculate estimated refund for override confirmation preview
  const estimatedRefundPaise = useMemo(() => {
    if (!overrideModalBooking) return 0;
    const paidPaise =
      overrideModalBooking.payment_status === "paid" ? overrideModalBooking.total_paise : 0;
    const remainingPaise = Math.max(0, paidPaise - (overrideModalBooking.refund_paise || 0));

    if (overrideAction === "cancel_full_refund") {
      return remainingPaise;
    }
    if (overrideAction === "cancel_no_refund" || overrideAction === "mark_no_show") {
      return 0;
    }
    if (overrideAction === "cancel_by_policy") {
      if (remainingPaise <= 0) return 0;
      const startMs = new Date(overrideModalBooking.start_at).getTime();
      const nowMs = Date.now();
      const diffHours = (startMs - nowMs) / (1000 * 60 * 60);
      const diffMins = (startMs - nowMs) / (1000 * 60);

      if (diffHours >= 2) {
        return remainingPaise;
      } else if (diffMins >= 30) {
        return Math.round(remainingPaise * 0.5);
      } else {
        return 0;
      }
    }
    return 0;
  }, [overrideModalBooking, overrideAction]);

  const handleConfirmOverride = async () => {
    if (!overrideModalBooking) return;
    const trimmedReason = overrideReason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 300) {
      toast.error("Reason must be between 5 and 300 characters.");
      return;
    }

    try {
      await overrideMutation.mutateAsync({
        booking_id: overrideModalBooking.id,
        action: overrideAction,
        reason: trimmedReason,
      });

      toast.success(
        overrideAction === "mark_no_show"
          ? "Booking marked as No-Show. Slot released."
          : `Booking cancelled successfully. Refund: ${formatPaise(estimatedRefundPaise)}`,
      );
      setOverrideModalBooking(null);
      setOverrideReason("");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to override booking.";
      toast.error(msg);
    }
  };

  const isTerminalStatus = (status: string) =>
    ["completed", "cancelled", "no_show", "expired"].includes(status);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Bookings
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">All reservations</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">
              Total reservations: <strong className="text-foreground tabular-nums">{total}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search reference or plate..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
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
            <div className="flex items-center gap-1.5">
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
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear dates
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Status:</span>
            {["All", "active", "confirmed", "reserved", "completed", "cancelled", "no_show"].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Payment:</span>
            {["All", "paid", "pending", "refunded", "partially_refunded"].map((pst) => (
              <button
                key={pst}
                onClick={() => {
                  setPaymentStatusFilter(pst);
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-colors ${
                  paymentStatusFilter === pst
                    ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {pst.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table & State Management ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="size-8 mx-auto text-destructive" />
            <div className="text-sm font-semibold text-foreground">Failed to load reservations</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {error?.message ||
                "An unexpected error occurred while communicating with the database."}
            </p>
            <Button size="sm" variant="outline" onClick={handleRefresh} className="h-8 text-xs">
              Try again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-surface-elevated/40">
                <TableRow className="border-border/60">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Reference
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    User / Phone
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Plate
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Bay
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Payment
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Amount
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right w-28">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/60">
                      <TableCell colSpan={8} className="py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">
                          No reservations matched this filter criteria.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((b) => (
                    <TableRow key={b.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell className="font-mono font-bold text-foreground">
                        {b.reference}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {b.profiles?.full_name || "Guest"}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {b.profiles?.phone || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {b.plate_snapshot || b.vehicles?.plate_number || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-foreground">
                          Bay {b.parking_slots?.code || "—"}
                        </span>
                        <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                          ({b.parking_slots?.level_code || "—"})
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            b.status === "active"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : b.status === "confirmed"
                                ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                                : b.status === "completed"
                                  ? "border-border/60 text-muted-foreground bg-muted/40"
                                  : b.status === "reserved"
                                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                    : "border-destructive/40 text-destructive bg-destructive/10"
                          }`}
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] text-muted-foreground capitalize">
                          {b.payment_status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-right text-foreground tabular-nums">
                        {formatPaise(b.total_paise)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isTerminalStatus(b.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] font-mono text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                              onClick={() => {
                                setOverrideModalBooking(b);
                                setOverrideAction("cancel_by_policy");
                                setOverrideReason("");
                              }}
                              title="Override booking status"
                            >
                              <ShieldAlert className="size-3 mr-1" />
                              Override
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setSelectedBookingId(b.id)}
                            title="Inspect booking details"
                          >
                            <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="border-t border-border/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-mono">
          <div>
            Showing <strong className="text-foreground tabular-nums">{bookings.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{total}</strong> bookings
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

      {/* ── Detail Drawer ── */}
      <Sheet
        open={Boolean(selectedBookingId)}
        onOpenChange={(open) => !open && setSelectedBookingId(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-surface border-border">
          {bookingDetail && (
            <div className="space-y-6">
              <SheetHeader className="text-left border-b border-border/70 pb-4">
                <SheetTitle className="font-display text-xl font-bold">Booking Details</SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  Ref: {bookingDetail.reference} • {bookingDetail.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-xs">
                {/* User & Vehicle */}
                <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block font-bold">
                    User & Vehicle Info
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Customer:</span>
                    <strong className="text-foreground">
                      {bookingDetail.profiles?.full_name || "Guest Customer"}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-mono text-foreground">
                      {bookingDetail.profiles?.phone || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vehicle Plate:</span>
                    <strong className="font-mono text-foreground">
                      {bookingDetail.plate_snapshot || bookingDetail.vehicles?.plate_number || "—"}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vehicle Type:</span>
                    <span className="capitalize text-foreground font-mono">
                      {bookingDetail.vehicle_type_snapshot ||
                        bookingDetail.vehicles?.vehicle_type ||
                        "car"}
                    </span>
                  </div>
                </div>

                {/* Bay & Timing */}
                <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block font-bold">
                    Bay Allocation & Time
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Assigned Bay:</span>
                    <span className="font-mono font-bold text-foreground">
                      Bay {bookingDetail.parking_slots?.code || "—"} (Level{" "}
                      {bookingDetail.parking_slots?.level_code || "—"})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Start Time (IST):</span>
                    <span className="font-mono text-foreground">
                      {formatIstDateTime(bookingDetail.start_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">End Time (IST):</span>
                    <span className="font-mono text-foreground">
                      {formatIstDateTime(bookingDetail.end_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono uppercase px-2 py-0.5"
                    >
                      {bookingDetail.status}
                    </Badge>
                  </div>
                </div>

                {/* Financials & Refunds */}
                <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block font-bold">
                    Financial Snapshot
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Base Tariff:</span>
                    <span className="font-mono text-foreground">
                      {formatPaise(bookingDetail.base_paise)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">GST:</span>
                    <span className="font-mono text-foreground">
                      {formatPaise(bookingDetail.gst_paise)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/60 pt-2 font-semibold">
                    <span>Total Amount:</span>
                    <span className="font-mono text-foreground">
                      {formatPaise(bookingDetail.total_paise)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <span className="capitalize font-mono text-foreground">
                      {bookingDetail.payment_status}
                    </span>
                  </div>
                  {bookingDetail.refund_paise > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 pt-1">
                      <span>Total Refunded:</span>
                      <span className="font-mono font-bold">
                        {formatPaise(bookingDetail.refund_paise)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Override Action within Drawer */}
                {!isTerminalStatus(bookingDetail.status) && (
                  <Button
                    variant="outline"
                    className="w-full text-xs font-mono text-amber-400 border-amber-500/40 hover:bg-amber-500/10 gap-1.5"
                    onClick={() => {
                      setOverrideModalBooking(bookingDetail);
                      setOverrideAction("cancel_by_policy");
                      setOverrideReason("");
                      setSelectedBookingId(null);
                    }}
                  >
                    <ShieldAlert className="size-4" />
                    Administrative Override Action
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Override Modal Dialog ── */}
      <Dialog
        open={Boolean(overrideModalBooking)}
        onOpenChange={(open) => !open && setOverrideModalBooking(null)}
      >
        <DialogContent className="sm:max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display text-lg">
              <AlertTriangle className="size-5 text-amber-400" />
              Override Booking Status
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify reservation status for ref{" "}
              <strong className="text-foreground font-mono">
                {overrideModalBooking?.reference}
              </strong>
              . All administrative changes are logged to the audit ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Action selector */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground text-xs">Select Override Action</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    action: "cancel_by_policy",
                    label: "Cancel by Policy",
                    desc: "Applies standard cancellation tiers (full if >=2h, 50% if >=30m)",
                  },
                  {
                    action: "cancel_full_refund",
                    label: "Cancel with Full Refund",
                    desc: "Refunds 100% of the customer payment and frees the parking bay",
                  },
                  {
                    action: "cancel_no_refund",
                    label: "Cancel with No Refund",
                    desc: "Cancels booking immediately without issuing refund credits",
                  },
                  {
                    action: "mark_no_show",
                    label: "Mark as No-Show",
                    desc: "Customer failed to arrive; frees slot, payment is retained",
                  },
                ].map((opt) => (
                  <button
                    key={opt.action}
                    type="button"
                    onClick={() => setOverrideAction(opt.action as OverrideAction)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      overrideAction === opt.action
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Refund Preview Alert */}
            <div className="p-3 rounded-lg border border-border bg-background space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-[11px] font-mono">
                  Calculated Refund:
                </span>
                <strong className="font-mono text-sm text-emerald-400 tabular-nums">
                  {formatPaise(estimatedRefundPaise)}
                </strong>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Refunds are posted directly into the payment ledger and marked in the booking
                record.
              </p>
            </div>

            {/* Required Reason Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="font-medium text-foreground">
                  Reason for Override <span className="text-destructive">*</span>
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {overrideReason.trim().length}/300
                </span>
              </div>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason (5-300 characters, e.g. Customer requested cancellation via phone support)..."
                className="text-xs bg-background min-h-[75px]"
                maxLength={300}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOverrideModalBooking(null)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={overrideReason.trim().length < 5 || overrideMutation.isPending}
              onClick={handleConfirmOverride}
              className="h-8 text-xs gap-1.5"
            >
              {overrideMutation.isPending ? "Executing..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
