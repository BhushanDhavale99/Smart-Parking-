import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Zap, CarFront, Search, Filter, RefreshCw, AlertCircle } from "lucide-react";
import { requireAdminGuard } from "@/lib/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listSlots, type ParkingSlotRow } from "@/lib/parking.server";

export const Route = createFileRoute("/admin/map")({
  beforeLoad: async ({ location }) => {
    await requireAdminGuard(location);
  },
  head: () => ({
    meta: [
      { title: "ParkGrid Admin | Live Map" },
      {
        name: "description",
        content:
          "Multi-floor visual bay layout with database bay statuses and administrative controls.",
      },
    ],
  }),
  component: AdminLiveMapPage,
});

type OperationalStatus = "active" | "maintenance" | "blocked";

const STATUS_CONFIG: Record<
  OperationalStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  active: {
    label: "Available",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  maintenance: {
    label: "Maintenance",
    bg: "bg-rose-500/10 hover:bg-rose-500/20",
    border: "border-rose-500/40",
    text: "text-rose-400",
    dot: "bg-rose-500",
  },
  blocked: {
    label: "Blocked",
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
    border: "border-amber-500/40",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
};

export function AdminLiveMapPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSlot, setActiveSlot] = useState<ParkingSlotRow | null>(null);

  const [allSlots, setAllSlots] = useState<ParkingSlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const levels = ["All", "B2", "B1", "G1", "L1", "L2"];
  const statuses = ["All", "active", "maintenance", "blocked"];

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listSlots({
        data: {
          level: "All",
          pageSize: 0, // Load all 150 bays
        },
      });
      setAllSlots(res.slots as unknown as ParkingSlotRow[]);
    } catch (err: unknown) {
      console.error("[AdminLiveMap] Failed to load facility slots:", err);
      setErrorMsg("Failed to load map bays. Please check your database connection or retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const filteredSlots = useMemo(() => {
    return allSlots.filter((slot) => {
      if (selectedLevel !== "All" && slot.level_code !== selectedLevel) return false;
      if (statusFilter !== "All" && slot.admin_status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!slot.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allSlots, selectedLevel, statusFilter, searchQuery]);

  const countByStatus = useMemo(() => {
    return {
      active: allSlots.filter((s) => s.admin_status === "active").length,
      maintenance: allSlots.filter((s) => s.admin_status === "maintenance").length,
      blocked: allSlots.filter((s) => s.admin_status === "blocked").length,
    };
  }, [allSlots]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Live Map
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
            Multi-floor visual bay layout. Live occupancy arrives with bookings; slot statuses
            reflect admin maintenance/blocked controls.
          </p>
        </div>

        {/* Legend & Refresh */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
          {(["active", "maintenance", "blocked"] as OperationalStatus[]).map((st) => {
            const conf = STATUS_CONFIG[st];
            return (
              <span
                key={st}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-border/70 text-[11px]"
              >
                <span className={cn("size-2 rounded-full", conf.dot)} />
                <span className="capitalize">{conf.label}</span>
                <span className="text-muted-foreground font-semibold">({countByStatus[st]})</span>
              </span>
            );
          })}

          <Button
            size="sm"
            variant="outline"
            onClick={loadSlots}
            disabled={loading}
            className="h-8 text-xs gap-1.5 ml-2"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface">
        {/* Level Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs font-mono text-muted-foreground uppercase px-2 shrink-0">
            Level:
          </span>
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0",
                selectedLevel === lvl
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {lvl === "All" ? "All Levels" : lvl}
            </button>
          ))}
        </div>

        {/* Status Pills & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-mono capitalize transition-colors shrink-0",
                  statusFilter === st
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {st === "All"
                  ? "All States"
                  : (STATUS_CONFIG[st as OperationalStatus]?.label ?? st)}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bay (e.g. G1-01)..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* ── Interactive Grid Layout ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Bay Map Grid */}
        <div className="rounded-xl border border-border bg-surface/50 p-5 min-h-[480px]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase text-muted-foreground">
              Showing {filteredSlots.length} bays (
              {selectedLevel === "All" ? "Across all levels" : `Level ${selectedLevel}`})
            </span>
            <span className="text-xs text-muted-foreground">Click any bay to inspect details</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg border border-border/40 bg-accent/30 animate-pulse"
                />
              ))}
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="size-8 text-destructive mb-2 opacity-80" />
              <p className="text-sm font-medium text-foreground">{errorMsg}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={loadSlots}
                className="mt-4 text-xs gap-1.5"
              >
                <RefreshCw className="size-3" /> Retry
              </Button>
            </div>
          ) : filteredSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Filter className="size-8 text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No bays match this filter</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try resetting the level or status query.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 text-xs"
                onClick={() => {
                  setSelectedLevel("All");
                  setStatusFilter("All");
                  setSearchQuery("");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {filteredSlots.map((slot) => {
                const conf = STATUS_CONFIG[slot.admin_status] ?? STATUS_CONFIG.active;
                const isSelected = activeSlot?.id === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlot(slot)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all duration-150 cursor-pointer",
                      conf.bg,
                      conf.border,
                      isSelected &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]",
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <strong className="font-mono text-sm font-bold text-foreground">
                        {slot.code}
                      </strong>
                      {slot.slot_type === "ev" ? (
                        <span title="EV Fast Charger">
                          <Zap className="size-3.5 text-cyan-400" />
                        </span>
                      ) : slot.slot_type === "accessible" ? (
                        <span
                          className="text-[10px] text-blue-400 font-mono font-bold"
                          title="Accessible Priority"
                        >
                          ♿
                        </span>
                      ) : (
                        <CarFront className="size-3.5 text-muted-foreground opacity-60" />
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span
                        className={cn("font-mono text-[10px] font-semibold uppercase", conf.text)}
                      >
                        {conf.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ₹{Math.round(slot.hourly_rate_paise / 100)}/h
                      </span>
                    </div>

                    {slot.notes && (
                      <div className="mt-1 pt-1 border-t border-border/40 font-mono text-[9px] text-muted-foreground truncate w-full">
                        {slot.notes}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Slot Inspector Panel */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4 h-fit sticky top-40">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="font-display font-semibold text-base text-foreground">Bay Inspector</h2>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-primary/40 text-primary"
            >
              Facility Bay
            </Badge>
          </div>

          {activeSlot ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Selected Bay
                  </span>
                  <div className="font-display text-2xl font-bold text-foreground">
                    {activeSlot.code}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-mono uppercase px-2 py-0.5",
                    STATUS_CONFIG[activeSlot.admin_status]?.border,
                    STATUS_CONFIG[activeSlot.admin_status]?.text,
                  )}
                >
                  {STATUS_CONFIG[activeSlot.admin_status]?.label}
                </Badge>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Facility Level</span>
                  <span className="font-mono font-semibold text-foreground">
                    Level {activeSlot.level_code}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Designated Zone</span>
                  <span className="text-foreground">Zone {activeSlot.zone}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Bay Classification</span>
                  <span className="font-medium capitalize text-foreground">
                    {activeSlot.slot_type === "ev"
                      ? "EV Fast Charge Bay"
                      : activeSlot.slot_type === "accessible"
                        ? "Accessible Ramp Priority"
                        : "Standard Passenger Vehicle"}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Base Tariff</span>
                  <span className="font-mono font-semibold text-foreground">
                    ₹{Math.round(activeSlot.hourly_rate_paise / 100)}/hr
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">EV Fast Charger</span>
                  <span className="font-mono text-foreground">
                    {activeSlot.has_ev_charger ? "Equipped (60kW / 22kW)" : "No charger"}
                  </span>
                </div>
                {activeSlot.notes && (
                  <div className="py-2 flex flex-col gap-1">
                    <span className="text-muted-foreground">Admin Notes</span>
                    <span className="text-foreground bg-accent/40 p-2 rounded text-[11px]">
                      {activeSlot.notes}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setActiveSlot(null)}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <MapPin className="size-8 mx-auto mb-2 opacity-40 text-primary" />
              <p className="text-xs">
                Select any parking slot in the grid to inspect details and operational state.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
