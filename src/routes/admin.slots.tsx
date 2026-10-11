import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Grid3X3,
  Search,
  ArrowUpRight,
  Zap,
  CarFront,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { DemoBadge } from "@/components/admin/demo-badge";
import { ADMIN_SLOTS, type AdminSlot } from "@/mocks/admin";
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

export const Route = createFileRoute("/admin/slots")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Slots" },
      {
        name: "description",
        content: "Directory of parking bays, types, tariffs, and current status.",
      },
    ],
  }),
  component: AdminSlotsPage,
});

function AdminSlotsPage() {
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredSlots = useMemo(() => {
    return ADMIN_SLOTS.filter((slot) => {
      if (levelFilter !== "All" && slot.level !== levelFilter) return false;
      if (statusFilter !== "All" && slot.status !== statusFilter) return false;
      if (typeFilter !== "All" && slot.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = slot.code.toLowerCase().includes(q);
        const matchPlate = slot.currentVehiclePlate?.toLowerCase().includes(q) ?? false;
        if (!matchCode && !matchPlate) return false;
      }
      return true;
    });
  }, [levelFilter, statusFilter, typeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredSlots.length / pageSize) || 1;
  const paginatedSlots = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredSlots.slice(from, from + pageSize);
  }, [filteredSlots, page, pageSize]);

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
              Slots
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Directory of parking bays, types, tariffs, and current status.
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

          <Link to="/admin/map">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
              View Live Map <ArrowUpRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 min-w-[240px] flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by bay code or license plate..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="All">All Levels</option>
            <option value="B2">Level B2</option>
            <option value="B1">Level B1</option>
            <option value="G1">Level G1</option>
            <option value="L1">Level L1</option>
            <option value="L2">Level L2</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="All">All Types</option>
            <option value="standard">Standard</option>
            <option value="ev">EV Charger</option>
            <option value="accessible">Accessible</option>
            <option value="valet">Valet</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="All">All Statuses</option>
            <option value="free">Available</option>
            <option value="occupied">Occupied</option>
            <option value="booked">Booked</option>
            <option value="blocked">Blocked</option>
            <option value="maintenance">Maintenance</option>
          </select>

          {/* Rows per page */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          >
            <option value={15}>15 / page</option>
            <option value={30}>30 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* ── Slots Table Container (horizontal scroll container) ── */}
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
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground w-28">
                    Bay Code
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Floor / Zone
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Occupant Vehicle
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Duration
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Tariff
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/60">
                      <TableCell colSpan={7} className="py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-accent/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedSlots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">No slots match your search criteria.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSlots.map((slot) => (
                    <TableRow key={slot.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell className="font-mono font-bold text-foreground tabular-nums">
                        {slot.code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        Level {slot.level} • {slot.zone}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 capitalize text-foreground">
                          {slot.type === "ev" ? (
                            <Zap className="size-3 text-cyan-400" />
                          ) : slot.type === "valet" ? (
                            <Sparkles className="size-3 text-amber-400" />
                          ) : (
                            <CarFront className="size-3 text-muted-foreground" />
                          )}
                          {slot.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            slot.status === "free"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : slot.status === "occupied"
                                ? "border-border/60 text-muted-foreground bg-muted/40"
                                : slot.status === "booked"
                                  ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                                  : slot.status === "maintenance"
                                    ? "border-destructive/40 text-destructive bg-destructive/10"
                                    : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                          }`}
                        >
                          {slot.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {slot.currentVehiclePlate ? (
                          <span className="text-foreground font-semibold">
                            {slot.currentVehiclePlate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground tabular-nums">
                        {slot.parkedSince ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-right text-foreground tabular-nums">
                        ₹{slot.hourlyRate}/h
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
            <strong className="text-foreground tabular-nums">{paginatedSlots.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{filteredSlots.length}</strong> bays
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
