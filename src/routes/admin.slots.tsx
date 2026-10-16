import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  ArrowUpRight,
  Zap,
  CarFront,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Inbox,
  Settings2,
} from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listSlots, adminUpdateSlot, type ParkingSlotRow } from "@/lib/parking.server";
import { toast } from "sonner";

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

export function AdminSlotsPage() {
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [slots, setSlots] = useState<ParkingSlotRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status Change Dialog State
  const [editingSlot, setEditingSlot] = useState<ParkingSlotRow | null>(null);
  const [targetStatus, setTargetStatus] = useState<"active" | "maintenance" | "blocked">("active");
  const [targetNotes, setTargetNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listSlots({
        data: {
          level: levelFilter as "All" | "B2" | "B1" | "G1" | "L1" | "L2",
          slot_type: typeFilter as "All" | "standard" | "ev" | "accessible",
          admin_status: statusFilter as "All" | "active" | "maintenance" | "blocked",
          search: debouncedSearch,
          page,
          pageSize,
        },
      });
      setSlots(res.slots as unknown as ParkingSlotRow[]);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      console.error("[AdminSlotsPage] Error fetching slots:", err);
      setErrorMsg("Failed to load parking slots. Please check your database connection or retry.");
    } finally {
      setLoading(false);
    }
  }, [levelFilter, typeFilter, statusFilter, debouncedSearch, page, pageSize]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const openStatusDialog = (slot: ParkingSlotRow) => {
    setEditingSlot(slot);
    setTargetStatus(slot.admin_status);
    setTargetNotes(slot.notes ?? "");
  };

  const handleUpdateStatus = async () => {
    if (!editingSlot) return;
    setIsUpdating(true);
    try {
      await adminUpdateSlot({
        data: {
          id: editingSlot.id,
          admin_status: targetStatus,
          notes: targetNotes.trim() ? targetNotes.trim() : null,
        },
      });
      toast.success(`Bay ${editingSlot.code} status updated to ${targetStatus}`);
      setEditingSlot(null);
      await loadSlots();
    } catch (err: unknown) {
      console.error("[AdminSlotsPage] Status update failed:", err);
      toast.error("Failed to update slot status");
    } finally {
      setIsUpdating(false);
    }
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
            <Badge
              variant="outline"
              className="gap-1 border-primary/40 bg-primary/10 text-primary text-[10px] font-mono px-2 py-0.5 rounded"
            >
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live facility bays
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Directory of parking bays, types, tariffs, and current status. Live occupancy arrives
            with bookings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadSlots}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by bay code (e.g. G1-01, B2-15)..."
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
            <option value="active">Active (Available)</option>
            <option value="maintenance">Maintenance</option>
            <option value="blocked">Blocked</option>
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

      {/* ── Slots Table Container ── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        {errorMsg ? (
          <div className="p-8 text-center text-xs">
            <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
            <p className="text-foreground font-semibold">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={loadSlots} className="mt-4 text-xs">
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
                    Level / Zone
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Admin Status
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Tariff
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">
                    Notes
                  </TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                    Action
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
                ) : slots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                        <Inbox className="size-6 text-muted-foreground/60" />
                        <span className="text-xs">No slots match your search criteria.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  slots.map((slot) => (
                    <TableRow key={slot.id} className="border-border/60 text-xs hover:bg-accent/40">
                      <TableCell className="font-mono font-bold text-foreground tabular-nums">
                        {slot.code}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        Level {slot.level_code} • Zone {slot.zone}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 capitalize text-foreground">
                          {slot.slot_type === "ev" ? (
                            <>
                              <Zap className="size-3 text-cyan-400" />
                              EV Charger
                            </>
                          ) : slot.slot_type === "accessible" ? (
                            <>
                              <span className="text-blue-400 font-bold">♿</span>
                              Accessible
                            </>
                          ) : (
                            <>
                              <CarFront className="size-3 text-muted-foreground" />
                              Standard
                            </>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            slot.admin_status === "active"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : slot.admin_status === "maintenance"
                                ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                                : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                          }`}
                        >
                          {slot.admin_status === "active" ? "Available" : slot.admin_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-foreground tabular-nums">
                        ₹{Math.round(slot.hourly_rate_paise / 100)}/h
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                        {slot.notes ? slot.notes : <span className="opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStatusDialog(slot)}
                          className="h-7 px-2 text-xs gap-1 font-mono hover:bg-accent"
                          title="Change bay state"
                        >
                          <Settings2 className="size-3" />
                          Set Status
                        </Button>
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
            Showing <strong className="text-foreground tabular-nums">{slots.length}</strong> of{" "}
            <strong className="text-foreground tabular-nums">{totalCount}</strong> bays
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

      {/* ── Confirm Status Change Dialog ── */}
      <Dialog open={Boolean(editingSlot)} onOpenChange={(open) => !open && setEditingSlot(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Bay State: {editingSlot?.code}</DialogTitle>
            <DialogDescription>
              Set operational status for Level {editingSlot?.level_code} • Zone {editingSlot?.zone}.
              Changes take immediate effect for drivers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Operational State</label>
              <div className="grid grid-cols-3 gap-2">
                {(["active", "maintenance", "blocked"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTargetStatus(st)}
                    className={`px-3 py-2 rounded-lg border text-xs font-mono capitalize transition-colors text-center ${
                      targetStatus === st
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {st === "active" ? "Active (Available)" : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Admin Notes (optional)</label>
              <textarea
                value={targetNotes}
                onChange={(e) => setTargetNotes(e.target.value)}
                placeholder="Reason for maintenance or operational notes..."
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingSlot(null)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateStatus}
              disabled={isUpdating}
              className="gap-1.5"
            >
              {isUpdating && <RefreshCw className="size-3.5 animate-spin" />}
              Confirm Status Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
