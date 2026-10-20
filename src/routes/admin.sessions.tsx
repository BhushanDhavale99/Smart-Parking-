import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Inbox,
  AlertTriangle,
  StopCircle,
  Clock,
  Car,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import {
  useAdminSessions,
  useAdminActiveSessions,
  useEndSession,
  type AdminSessionRow,
  type AdminActiveSessionRow,
} from "@/hooks/useSessions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatIstDateTime, formatPaise } from "@/lib/date-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sessions")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Sessions" },
      {
        name: "description",
        content: "Automated parking sessions, active vehicles, and overstay charge records.",
      },
    ],
  }),
  component: AdminSessionsPage,
});

function AdminSessionsPage() {
  const [activeTab, setActiveTab] = useState<"active_now" | "all_sessions">("active_now");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [endTarget, setEndTarget] = useState<{ id: string; plate: string; ref: string } | null>(
    null,
  );

  // Active Sessions Query
  const {
    data: activeSessions,
    isLoading: isLoadingActive,
    isError: isErrorActive,
    error: errorActive,
    refetch: refetchActive,
    isFetching: isFetchingActive,
  } = useAdminActiveSessions();

  // All Sessions Query
  const {
    data: allSessionsData,
    isLoading: isLoadingAll,
    isError: isErrorAll,
    error: errorAll,
    refetch: refetchAll,
    isFetching: isFetchingAll,
  } = useAdminSessions({
    status: statusFilter,
    search: searchQuery,
    page,
    pageSize,
  });

  const endSessionMutation = useEndSession();

  const sessions = allSessionsData?.sessions ?? [];
  const totalCount = allSessionsData?.totalCount ?? 0;
  const totalPages = allSessionsData?.totalPages ?? 1;

  const activeList = activeSessions ?? [];
  const overstayCount = activeList.filter((s) => s.isOverstay || s.overstayMinutes > 0).length;
  const totalActiveOverstayCharges = activeList.reduce((acc, s) => acc + s.overstayChargePaise, 0);

  const handleEndSession = async () => {
    if (!endTarget) return;
    try {
      const res = await endSessionMutation.mutateAsync({
        sessionId: endTarget.id,
      });
      toast.success(
        res.overstayTotalPaise > 0
          ? `Session ended for ${endTarget.plate}. Overstay fee of ${formatPaise(res.overstayTotalPaise)} charged.`
          : `Session ended for ${endTarget.plate}.`,
      );
      setEndTarget(null);
      refetchActive();
      refetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to end parking session");
    }
  };

  const handleRefresh = () => {
    if (activeTab === "active_now") {
      refetchActive();
    } else {
      refetchAll();
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Sessions
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Vehicles parked now and past stays
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetchingActive || isFetchingAll}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw
              className={`size-3.5 ${isFetchingActive || isFetchingAll ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("active_now")}
          className={`pb-2.5 px-3 text-xs font-mono font-medium transition-all relative ${
            activeTab === "active_now"
              ? "text-primary border-b-2 border-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>Active Now</span>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
            >
              {activeList.length}
            </Badge>
            {overstayCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400 bg-amber-500/10"
              >
                {overstayCount} overstay
              </Badge>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("all_sessions")}
          className={`pb-2.5 px-3 text-xs font-mono font-medium transition-all relative ${
            activeTab === "all_sessions"
              ? "text-primary border-b-2 border-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>All Sessions</span>
        </button>
      </div>

      {/* ── TAB 1: ACTIVE NOW ── */}
      {activeTab === "active_now" && (
        <div className="space-y-4">
          {/* Active summary telemetry cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <span className="text-xs text-muted-foreground font-medium block">
                Occupied Bays Now
              </span>
              <strong className="text-2xl font-bold font-mono text-foreground mt-1 block">
                {activeList.length}
              </strong>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm text-amber-400">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Overstaying Vehicles</span>
                <AlertTriangle className="size-4" />
              </div>
              <strong className="text-2xl font-bold font-mono mt-1 block">{overstayCount}</strong>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <span className="text-xs text-muted-foreground font-medium block">
                Live Overstay Accruals
              </span>
              <strong className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {formatPaise(totalActiveOverstayCharges)}
              </strong>
            </div>
          </div>

          {/* Active Sessions Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
            {isErrorActive ? (
              <div className="p-8 text-center text-xs">
                <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
                <p className="text-foreground font-semibold">
                  {errorActive instanceof Error
                    ? errorActive.message
                    : "Failed to load active sessions."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchActive()}
                  className="mt-4 text-xs"
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full">
                <Table>
                  <TableHeader className="bg-surface-elevated/40">
                    <TableRow className="border-border/60">
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Booking / Bay
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Vehicle & Customer
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Started (IST)
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Booked End (IST)
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Overstay Status
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                        Overstay Fee
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right w-28">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingActive ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i} className="border-border/60">
                          <TableCell colSpan={7} className="py-4">
                            <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : activeList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-32 text-center text-muted-foreground text-xs"
                        >
                          <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                            <Inbox className="size-6 text-muted-foreground/60" />
                            <span>No active vehicles currently in bays.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeList.map((s) => (
                        <TableRow
                          key={s.sessionId}
                          className={`border-border/60 text-xs hover:bg-accent/40 ${
                            s.isOverstay || s.overstayMinutes > 0 ? "bg-amber-500/[0.04]" : ""
                          }`}
                        >
                          <TableCell>
                            <div className="font-mono font-bold text-foreground">
                              {s.bookingReference}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              Bay {s.slotCode} (Level {s.levelCode})
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono font-bold text-foreground">
                              {s.plateSnapshot}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.userFullName || "Guest"}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {formatIstDateTime(s.startedAt)}
                          </TableCell>
                          <TableCell className="font-mono text-foreground font-medium">
                            {formatIstDateTime(s.bookedEndAt)}
                          </TableCell>
                          <TableCell>
                            {s.isOverstay || s.overstayMinutes > 0 ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-mono text-[10px] animate-pulse"
                              >
                                <AlertTriangle className="size-3 mr-1" />
                                {s.overstayMinutes}m Overstay
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[10px]"
                              >
                                <CheckCircle2 className="size-3 mr-1" />
                                On Schedule
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums">
                            {s.overstayChargePaise > 0 ? (
                              <span className="text-amber-400">
                                {formatPaise(s.overstayChargePaise)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">₹0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] font-mono text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() =>
                                setEndTarget({
                                  id: s.sessionId,
                                  plate: s.plateSnapshot,
                                  ref: s.bookingReference,
                                })
                              }
                            >
                              <StopCircle className="size-3 mr-1" />
                              End
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: ALL SESSIONS LEDGER ── */}
      {activeTab === "all_sessions" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search license plate or bay..."
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 font-mono text-xs">
                {[
                  { id: "All", label: "All Sessions" },
                  { id: "active", label: "Active" },
                  { id: "completed", label: "Completed" },
                  { id: "auto_ended", label: "Auto Ended" },
                  { id: "cancelled", label: "Cancelled" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setStatusFilter(item.id);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      statusFilter === item.id
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground font-mono"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          {/* Sessions Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
            {isErrorAll ? (
              <div className="p-8 text-center text-xs">
                <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
                <p className="text-foreground font-semibold">
                  {errorAll instanceof Error ? errorAll.message : "Failed to load sessions."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchAll()}
                  className="mt-4 text-xs"
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full">
                <Table>
                  <TableHeader className="bg-surface-elevated/40">
                    <TableRow className="border-border/60">
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Booking / Ref
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Vehicle & Customer
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Bay
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Started
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                        Ended
                      </TableHead>
                      <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                        Overstay Fee
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingAll ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-border/60">
                          <TableCell colSpan={7} className="py-4">
                            <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : sessions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-32 text-center text-muted-foreground text-xs"
                        >
                          No parking sessions recorded for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sessions.map((s) => (
                        <TableRow
                          key={s.sessionId}
                          className="border-border/60 text-xs hover:bg-accent/40"
                        >
                          <TableCell>
                            <span className="font-mono font-bold text-foreground">
                              {s.bookingReference}
                            </span>
                            <span className="block text-[10px] font-mono text-muted-foreground">
                              {s.sessionId.slice(0, 8)}...
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono font-bold text-foreground">
                              {s.plateSnapshot}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.userFullName || "Guest"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-medium text-foreground">
                              Bay {s.slotCode}
                            </span>
                            <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                              ({s.levelCode})
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                                s.status === "active"
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                  : s.status === "completed"
                                    ? "border-border/60 text-muted-foreground bg-muted/40"
                                    : s.status === "auto_ended"
                                      ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                                      : "border-destructive/40 text-destructive bg-destructive/10"
                              }`}
                            >
                              {s.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {formatIstDateTime(s.startedAt)}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {s.endedAt ? formatIstDateTime(s.endedAt) : "Active"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums">
                            {s.overstayTotalPaise > 0 ? (
                              <span className="text-amber-400">
                                {formatPaise(s.overstayTotalPaise)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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
                Showing <strong className="text-foreground tabular-nums">{sessions.length}</strong>{" "}
                of <strong className="text-foreground tabular-nums">{totalCount}</strong> sessions
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={page <= 1 || isLoadingAll}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={page >= totalPages || isLoadingAll}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End Session Confirmation Dialog */}
      <AlertDialog open={Boolean(endTarget)} onOpenChange={(open) => !open && setEndTarget(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              End Parking Session
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to manually conclude the active parking session for vehicle{" "}
              <strong className="text-foreground font-mono">{endTarget?.plate}</strong> (Ref:{" "}
              <span className="font-mono">{endTarget?.ref}</span>)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              disabled={endSessionMutation.isPending}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {endSessionMutation.isPending ? "Ending..." : "End Session Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
