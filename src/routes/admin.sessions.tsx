import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { DemoBadge } from "@/components/admin/demo-badge";
import { ADMIN_SESSIONS, type AdminSession } from "@/mocks/admin";
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

export const Route = createFileRoute("/admin/sessions")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Sessions" },
      {
        name: "description",
        content: "Barrier gate entry and exit records and active parking sessions.",
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    return ADMIN_SESSIONS.filter((s) => {
      if (statusFilter === "in_progress" && s.status !== "in_progress") return false;
      if (statusFilter === "completed" && s.status !== "completed") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPlate = s.vehiclePlate.toLowerCase().includes(q);
        const matchSlot = s.slotCode.toLowerCase().includes(q);
        const matchGate = s.entryGate.toLowerCase().includes(q);
        if (!matchPlate && !matchSlot && !matchGate) return false;
      }
      return true;
    });
  }, [statusFilter, searchQuery]);

  const activeCount = ADMIN_SESSIONS.filter((s) => s.status === "in_progress").length;
  const completedCount = ADMIN_SESSIONS.filter((s) => s.status === "completed").length;

  const totalPages = Math.ceil(filteredSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredSessions.slice(from, from + pageSize);
  }, [filteredSessions, page, pageSize]);

  const handleRefresh = () => {
    setLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      setLoading(false);
    }, 250);
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
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Barrier gate entry and exit records and active parking sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">
              Active: <strong className="text-emerald-400 tabular-nums">{activeCount}</strong>
            </span>
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">
              Completed: <strong className="text-foreground tabular-nums">{completedCount}</strong>
            </span>
          </div>
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
            placeholder="Search license plate, gate, or bay..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {[
              { id: "All", label: "All Sessions" },
              { id: "in_progress", label: "In Facility" },
              { id: "completed", label: "Exited" },
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

      {/* ── Sessions Table (horizontal scroll container) ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        {errorMsg ? (
          <div className="p-8 text-center text-xs">
            <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
            <p className="text-foreground font-semibold">{errorMsg}</p>
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
                    Session
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Vehicle Plate
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Bay / Floor
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Entry Gate & Time
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Exit Gate & Time
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Duration
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Fee
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/60">
                      <TableCell colSpan={8} className="py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">No sessions match this filter.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSessions.map((s) => (
                    <TableRow key={s.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell className="font-mono font-bold text-foreground">{s.id}</TableCell>
                      <TableCell>
                        <div className="font-mono font-semibold text-foreground">
                          {s.vehiclePlate}
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {s.vehicleType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-foreground">
                          Bay {s.slotCode}
                        </span>
                        <span className="text-muted-foreground ml-1.5 text-[11px] font-mono">
                          (Lvl {s.level})
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground">{s.entryGate}</div>
                        <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          {s.entryTime.replace("+05:30", "").split("T")[1]} IST
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.exitTime ? (
                          <>
                            <div className="text-foreground">{s.exitGate}</div>
                            <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                              {s.exitTime.replace("+05:30", "").split("T")[1]} IST
                            </div>
                          </>
                        ) : (
                          <span className="font-mono text-muted-foreground/50">
                            — Active inside —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground tabular-nums">
                        {Math.floor(s.durationMinutes / 60)}h {s.durationMinutes % 60}m
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            s.status === "in_progress"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : "border-border/60 text-muted-foreground bg-muted/40"
                          }`}
                        >
                          {s.status === "in_progress" ? "In Facility" : "Exited"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-right text-foreground tabular-nums">
                        ₹{s.feeAmount}
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
            Showing{" "}
            <strong className="text-foreground tabular-nums">{paginatedSessions.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{filteredSessions.length}</strong>{" "}
            sessions
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
