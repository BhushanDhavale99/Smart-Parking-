import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck,
  Search,
  Eye,
  QrCode,
  CheckCircle2,
  Clock,
  Car,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { DemoBadge } from "@/components/admin/demo-badge";
import { useAdminBookings, type AdminBookingRow } from "@/hooks/useBookings";
import { formatIstDateTime, formatPaise } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminBookings({
    status: statusFilter === "All" ? undefined : statusFilter.toLowerCase(),
    search: searchQuery.trim() || undefined,
    page,
    pageSize,
  });

  const bookings = data?.bookings ?? [];
  const total = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? (Math.ceil(total / pageSize) || 1);

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Bookings
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Customer reservations, vehicle plates, and payment status.
          </p>
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search booking ref, plate, or slot..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto">
            {["All", "active", "confirmed", "reserved", "completed", "cancelled"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* ── Bookings Table ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        {isError ? (
          <div className="p-8 text-center text-xs">
            <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
            <p className="text-foreground font-semibold">
              {error instanceof Error ? error.message : "Failed to load bookings"}
            </p>
            <Button size="sm" variant="outline" onClick={handleRefresh} className="mt-4 text-xs">
              Try again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Reference
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Vehicle
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Bay / Level
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
                  <TableHead className="w-14"></TableHead>
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
                        <span className="text-xs">No reservations matched this filter.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((b) => (
                    <TableRow key={b.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell className="font-mono font-bold text-foreground">
                        {b.reference}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {b.profiles?.full_name || "Customer"}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {b.plate_snapshot || b.vehicles?.plate_number || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-foreground">
                          Bay {b.parking_slots?.code || "—"}
                        </span>
                        <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
                          (Lvl {b.parking_slots?.level_code || "—"})
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setSelectedBooking(b)}
                          title="Inspect booking details"
                        >
                          <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Consistent Pagination Footer */}
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
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Booking Detail Drawer ── */}
      <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-surface border-border p-6 overflow-y-auto"
        >
          {selectedBooking && (
            <div className="space-y-6">
              <SheetHeader className="text-left border-b border-border/70 pb-4">
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-display text-xl font-bold">
                    Booking Details
                  </SheetTitle>
                  <DemoBadge />
                </div>
                <SheetDescription className="font-mono text-xs">
                  Ref: {selectedBooking.reference} • {selectedBooking.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-xs">
                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Guest & Vehicle
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Guest:</span>
                    <strong className="text-foreground">
                      {selectedBooking.profiles?.full_name || "Customer"}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vehicle Plate:</span>
                    <strong className="font-mono text-foreground">
                      {selectedBooking.plate_snapshot ||
                        selectedBooking.vehicles?.plate_number ||
                        "—"}
                    </strong>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Bay Allocation & Time
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Assigned Bay:</span>
                    <span className="font-mono font-bold text-foreground">
                      Bay {selectedBooking.parking_slots?.code || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Floor Level:</span>
                    <span className="text-foreground">
                      Level {selectedBooking.parking_slots?.level_code || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="font-mono text-foreground">
                      {formatIstDateTime(selectedBooking.start_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">End:</span>
                    <span className="font-mono text-foreground">
                      {formatIstDateTime(selectedBooking.end_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                        selectedBooking.status === "active"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : selectedBooking.status === "confirmed"
                            ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                            : selectedBooking.status === "reserved"
                              ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                              : "border-border/60 text-muted-foreground bg-muted/40"
                      }`}
                    >
                      {selectedBooking.status}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Financials
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Base Fee:</span>
                    <span className="font-mono text-foreground">
                      {formatPaise(selectedBooking.base_paise)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">GST (18%):</span>
                    <span className="font-mono text-foreground">
                      {formatPaise(selectedBooking.gst_paise)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/60 pt-2">
                    <span className="font-medium text-foreground">Total Fee:</span>
                    <strong className="font-mono text-foreground text-sm tabular-nums">
                      {formatPaise(selectedBooking.total_paise)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <span className="capitalize text-foreground font-mono">
                      {selectedBooking.payment_status}
                    </span>
                  </div>
                  {selectedBooking.refund_paise > 0 && (
                    <div className="flex justify-between items-center text-emerald-500">
                      <span className="font-medium">Refund Processed:</span>
                      <strong className="font-mono">
                        {formatPaise(selectedBooking.refund_paise)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
