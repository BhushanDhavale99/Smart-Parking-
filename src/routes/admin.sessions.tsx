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
  SquareSquare,
  AlertTriangle,
  StopCircle,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { useAdminSessions, useEndSession, type AdminSessionRow } from "@/hooks/useSessions";
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
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [endTarget, setEndTarget] = useState<AdminSessionRow | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminSessions({
    status: statusFilter,
    search: searchQuery,
    page,
    pageSize,
  });

  const endSessionMutation = useEndSession();

  const sessions = data?.sessions ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleEndSession = async () => {
    if (!endTarget) return;
    try {
      const res = await endSessionMutation.mutateAsync({
        sessionId: endTarget.sessionId,
      });
      toast.success(
        res.overstayTotalPaise > 0
          ? `Session ended. Overstay fee of ${formatPaise(res.overstayTotalPaise)} charged.`
          : "Parking session ended successfully.",
      );
      setEndTarget(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to end parking session");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Sessions
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Automated parking session lifecycle, active vehicles, and overstay charge audit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
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
          <div className="flex items-center gap-1">
            {[
              { id: "All", label: "All Sessions" },
              { id: "active", label: "Active" },
              { id: "completed", label: "Completed" },
              { id: "auto_ended", label: "Auto Ended" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setStatusFilter(item.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  statusFilter === item.id
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-accent"
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
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* ── Sessions Table ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        {isError ? (
          <div className="p-8 text-center text-xs">
            <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
            <p className="text-foreground font-semibold">
              {error instanceof Error ? error.message : "Failed to load sessions."}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-4 text-xs">
              Try again
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Booking / Session
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Vehicle Plate & User
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Bay / Floor
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Started (Entry)
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Booked End / Exit
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Duration
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Overstay Fee
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/60">
                      <TableCell colSpan={9} className="py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">No parking sessions match this filter.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s) => (
                    <TableRow
                      key={s.sessionId}
                      className="border-border/60 text-xs hover:bg-accent/40"
                    >
                      <TableCell>
                        <div className="font-mono font-bold text-foreground">
                          {s.bookingReference}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {s.sessionId.slice(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono font-semibold text-foreground">
                          {s.plateSnapshot}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {s.userFullName || "Member"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-foreground">
                          Bay {s.slotCode}
                        </span>
                        <span className="text-muted-foreground ml-1.5 text-[11px] font-mono">
                          (Lvl {s.levelCode})
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-foreground">
                          {formatIstDateTime(s.startedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.endedAt ? (
                          <div className="font-mono text-foreground">
                            {formatIstDateTime(s.endedAt)}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 font-mono text-emerald-400 text-[11px]">
                              <span className="live-dot" /> Parked (until{" "}
                              {formatIstDateTime(s.bookedEndAt)})
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground tabular-nums">
                        {s.durationMinutes != null
                          ? `${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m`
                          : "— In progress —"}
                      </TableCell>
                      <TableCell>
                        {s.status === "active" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          >
                            Active
                          </Badge>
                        ) : s.status === "auto_ended" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border-amber-500/40 text-amber-400 bg-amber-500/10 gap-1 inline-flex items-center"
                          >
                            <AlertTriangle className="size-2.5" /> Auto Ended
                          </Badge>
                        ) : s.status === "cancelled" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border-rose-500/40 text-rose-400 bg-rose-500/10"
                          >
                            Cancelled
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border-border/60 text-muted-foreground bg-muted/40"
                          >
                            Completed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-right text-foreground tabular-nums">
                        {s.overstayTotalPaise > 0 ? (
                          <span className="text-amber-400">
                            {formatPaise(s.overstayTotalPaise)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">₹0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === "active" && !s.endedAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() => setEndTarget(s)}
                          >
                            <StopCircle className="size-3" />
                            End
                          </Button>
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
            Showing <strong className="text-foreground tabular-nums">{sessions.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{totalCount}</strong> sessions
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

      {/* ── Admin End Session Confirmation Dialog ── */}
      <AlertDialog open={Boolean(endTarget)} onOpenChange={(open) => !open && setEndTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End parking session?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-muted-foreground text-left">
                <p>
                  You are about to manually end parking session for vehicle{" "}
                  <strong className="text-foreground">{endTarget?.plateSnapshot}</strong> at Bay{" "}
                  <strong className="text-foreground">{endTarget?.slotCode}</strong>.
                </p>
                <p>
                  Booked departure:{" "}
                  <strong className="text-foreground">
                    {endTarget ? formatIstDateTime(endTarget.bookedEndAt) : ""}
                  </strong>
                  . Any overstay beyond the 15-minute grace period will be computed and recorded.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={endSessionMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleEndSession();
              }}
              disabled={endSessionMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {endSessionMutation.isPending ? "Ending..." : "Confirm & End Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
