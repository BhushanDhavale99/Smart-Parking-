import { lazy, Suspense, useEffect, useState, useCallback } from "react";
const ParkingGrid3D = lazy(() => import("./ParkingGrid3D"));
import {
  CarFront,
  Zap,
  Accessibility,
  Bike,
  ArrowDown,
  Navigation,
  Check,
  CircleSlash2,
  TriangleAlert,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parkingSlots,
  type ParkingSlotData,
  type SlotStatus,
  type LevelCode,
  LEVEL_CONFIG,
  FLOOR_CONFIG,
} from "@/lib/parking-data";
import { listSlots, type ParkingSlotRow } from "@/lib/parking.server";

const statusClasses: Record<SlotStatus, string> = {
  available:
    "border-available/40 bg-available/8 text-available hover:border-available hover:bg-available/15",
  occupied: "border-occupied/35 bg-occupied/8 text-occupied opacity-80",
  reserved: "border-reserved/40 bg-reserved/8 text-reserved opacity-85",
  selected:
    "border-selected bg-selected/20 text-selected shadow-[0_0_20px_var(--selected-glow)] ring-2 ring-selected/50",
  maintenance: "border-border/60 bg-muted/40 text-muted-foreground",
  blocked: "border-border/60 bg-muted/40 text-muted-foreground",
};

export function StatusBadge({
  status,
}: {
  status:
    | SlotStatus
    | "active"
    | "completed"
    | "cancelled"
    | "confirmed"
    | "no_show"
    | "expired"
    | string;
}) {
  const tones: Record<string, { bg: string; dot: string; label: string }> = {
    available: {
      bg: "border-available/30 bg-available/10 text-available",
      dot: "bg-available",
      label: "Available",
    },
    occupied: {
      bg: "border-occupied/30 bg-occupied/10 text-occupied",
      dot: "bg-occupied",
      label: "Occupied",
    },
    reserved: {
      bg: "border-reserved/30 bg-reserved/10 text-reserved",
      dot: "bg-reserved",
      label: "Reserved",
    },
    confirmed: {
      bg: "border-available/30 bg-available/10 text-available",
      dot: "bg-available",
      label: "Confirmed",
    },
    selected: {
      bg: "border-selected/40 bg-selected/15 text-selected shadow-[0_0_12px_var(--selected-glow)]",
      dot: "bg-selected",
      label: "Selected",
    },
    active: {
      bg: "border-primary/40 bg-primary/15 text-primary shadow-[0_0_12px_var(--primary-glow)]",
      dot: "bg-primary",
      label: "Active",
    },
    completed: {
      bg: "border-border bg-muted/50 text-muted-foreground",
      dot: "bg-muted-foreground",
      label: "Completed",
    },
    cancelled: {
      bg: "border-destructive/30 bg-destructive/10 text-destructive",
      dot: "bg-destructive",
      label: "Cancelled",
    },
    no_show: {
      bg: "border-destructive/30 bg-destructive/10 text-destructive",
      dot: "bg-destructive",
      label: "No-show",
    },
    expired: {
      bg: "border-border bg-muted/50 text-muted-foreground",
      dot: "bg-muted-foreground",
      label: "Expired",
    },
    maintenance: {
      bg: "border-border bg-muted/50 text-muted-foreground",
      dot: "bg-muted-foreground",
      label: "Maintenance",
    },
    blocked: {
      bg: "border-border bg-muted/50 text-muted-foreground",
      dot: "bg-muted-foreground",
      label: "Blocked",
    },
  };

  const current = tones[status] ?? {
    bg: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-muted-foreground",
    label: status,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase",
        current.bg,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", current.dot)} />
      {current.label}
    </span>
  );
}

export function ParkingSlot({
  slot,
  selected,
  onSelect,
  compact = false,
}: {
  slot: ParkingSlotData;
  selected?: boolean;
  onSelect?: (slot: ParkingSlotData) => void;
  compact?: boolean;
}) {
  const disabled = slot.status !== "available";
  const Icon =
    slot.type === "EV"
      ? Zap
      : slot.type === "Bike"
        ? Bike
        : slot.type === "Accessible"
          ? Accessibility
          : CarFront;
  const displayStatus = selected ? "selected" : slot.status;
  return (
    <button
      type="button"
      aria-label={`${slot.id}, ${slot.status}, ${slot.type}`}
      aria-pressed={!disabled ? Boolean(selected) : undefined}
      aria-describedby={`${slot.id}-status`}
      title={
        disabled
          ? `${slot.id} is ${slot.status} and cannot be selected`
          : `Select ${slot.id}, ₹${slot.price} per hour`
      }
      disabled={disabled}
      onClick={() => onSelect?.(slot)}
      className={cn(
        "group relative flex min-h-20 flex-col justify-between overflow-hidden rounded-lg border p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75",
        compact ? "min-h-16" : "sm:min-h-24",
        statusClasses[displayStatus] ?? statusClasses.available,
        !disabled && "hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="flex w-full items-start justify-between gap-1">
        <span className="font-mono text-xs font-bold">{slot.id}</span>
        {selected ? (
          <Check className="size-4" aria-hidden="true" />
        ) : disabled ? (
          <CircleSlash2 className="size-4" aria-hidden="true" />
        ) : (
          <Icon className="size-4" aria-hidden="true" />
        )}
      </div>
      {!compact && (
        <div id={`${slot.id}-status`}>
          <p className="text-[10px] font-medium capitalize opacity-80">{slot.status}</p>
          <p className="text-[10px] opacity-75">₹{slot.price}/hr</p>
        </div>
      )}
      <span className="absolute inset-x-2 bottom-1 h-px bg-current opacity-20" />
    </button>
  );
}

const ORDERED_LEVELS: LevelCode[] = ["B2", "B1", "G1", "L1", "L2"];

export function ParkingMap({
  preview = false,
  onSelection,
  onSlotsLoaded,
  availabilityMap,
  level: externalLevel,
  onLevelChange,
}: {
  preview?: boolean;
  onSelection?: (slot: ParkingSlotData) => void;
  onSlotsLoaded?: (slots: ParkingSlotData[]) => void;
  availabilityMap?: Record<string, boolean>;
  level?: LevelCode;
  onLevelChange?: (level: LevelCode) => void;
}) {
  const [internalLevel, setInternalLevel] = useState<LevelCode>(externalLevel ?? "G1");
  const level = externalLevel ?? internalLevel;
  const setLevel = (newLevel: LevelCode) => {
    setInternalLevel(newLevel);
    onLevelChange?.(newLevel);
  };
  const [zone, setZone] = useState<"All" | "A" | "B" | "EV">("All");
  const [selected, setSelected] = useState<ParkingSlotData | null>(null);
  const [slots, setSlots] = useState<ParkingSlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pulsing, setPulsing] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listSlots({
        data: {
          level,
          zone,
          pageSize: 0,
        },
      });

      const mapped: ParkingSlotData[] = (res.slots as unknown as ParkingSlotRow[]).map(
        (slot, index) => {
          const isEv = slot.slot_type === "ev";
          const isAccessible = slot.slot_type === "accessible";
          const displayType: "Car" | "Bike" | "EV" | "Accessible" = isEv
            ? "EV"
            : isAccessible
              ? "Accessible"
              : "Car";
          const isSlotAvailable = availabilityMap
            ? (availabilityMap[slot.id] ?? availabilityMap[slot.code] ?? !(slot as any).is_occupied)
            : !(slot as any).is_occupied;
          const status: SlotStatus =
            slot.admin_status !== "active"
              ? "maintenance"
              : !isSlotAvailable
                ? "occupied"
                : "available";

          return {
            id: slot.code,
            code: slot.code,
            slotId: slot.id,
            levelCode: slot.level_code as LevelCode,
            floor: LEVEL_CONFIG[slot.level_code as LevelCode]?.sortOrder ?? 3,
            row: Math.floor(index / 4),
            col: index % 4,
            zone: slot.zone as "A" | "B" | "EV",
            status,
            type: displayType,
            slotType: slot.slot_type as "standard" | "ev" | "accessible",
            price: Math.round(slot.hourly_rate_paise / 100),
            hourlyRatePaise: slot.hourly_rate_paise,
            hasEvCharger: slot.has_ev_charger,
            adminStatus: slot.admin_status as "active" | "maintenance" | "blocked",
            notes: slot.notes,
          };
        },
      );
      setSlots(mapped);
      onSlotsLoaded?.(mapped);
    } catch {
      // Graceful fallback to seeded canonical slots if not logged in
      const fallback = parkingSlots
        .filter((slot) => slot.levelCode === level && (zone === "All" || slot.zone === zone))
        .map((slot) => {
          const isSlotAvailable = availabilityMap
            ? (availabilityMap[slot.slotId ?? ""] ?? availabilityMap[slot.id] ?? true)
            : true;
          return {
            ...slot,
            status: !isSlotAvailable ? ("occupied" as SlotStatus) : slot.status,
          };
        });
      setSlots(fallback);
      onSlotsLoaded?.(fallback);
    } finally {
      setLoading(false);
    }
  }, [level, zone, availabilityMap, onSlotsLoaded]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const visibleSlots = preview ? slots.slice(0, 10) : slots.slice(0, 12);

  const choose = (slot: ParkingSlotData) => {
    if (slot.status !== "available") return;
    // Pulse the slot with accent glow before updating selection
    setPulsing(slot.id);
    setTimeout(() => {
      setSelected(slot);
      setAnnouncement(`${slot.id} selected`);
      onSelection?.(slot);
      setPulsing(null);
    }, 300);
  };

  return (
    <div className="parking-grid overflow-hidden rounded-2xl border border-border/80 bg-surface/95 p-4 sm:p-6 shadow-sm">
      {!preview && (
        <div className="mb-5 flex flex-col gap-3">
          {/* ── Floor & Zone selectors ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-background/60 p-1"
              role="tablist"
              aria-label="Parking level"
            >
              {ORDERED_LEVELS.map((code) => {
                const conf = LEVEL_CONFIG[code];
                const isSelected = level === code;
                return (
                  <Button
                    key={code}
                    size="sm"
                    role="tab"
                    aria-selected={isSelected}
                    variant={isSelected ? "default" : "ghost"}
                    onClick={() => setLevel(code)}
                    className={cn(
                      "rounded-lg font-mono text-xs transition-all",
                      isSelected && "shadow-sm",
                    )}
                  >
                    <span>{conf.label}</span>
                    <span className="ml-1.5 hidden text-[9px] font-normal capitalize opacity-70 sm:inline">
                      {conf.category === "basement"
                        ? "↓ Under"
                        : conf.category === "ground"
                          ? "Ground"
                          : "↑ Upper"}
                    </span>
                  </Button>
                );
              })}
            </div>
            {/* ── Zone selector ── */}
            <div
              className="flex gap-1 rounded-xl border border-border/70 bg-background/60 p-1"
              role="tablist"
              aria-label="Parking zone"
            >
              {(["All", "A", "B", "EV"] as const).map((item) => (
                <Button
                  key={item}
                  size="sm"
                  aria-pressed={zone === item}
                  variant={zone === item ? "secondary" : "ghost"}
                  onClick={() => setZone(item)}
                  className="rounded-lg text-xs"
                >
                  {item === "EV" ? "⚡ EV Zone" : item === "All" ? "All zones" : `Zone ${item}`}
                </Button>
              ))}
            </div>
          </div>

          {/* ── Heavy-vehicle notice ── */}
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-500"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Heavy Vehicles</strong> are permitted only on{" "}
              <strong className="font-semibold">Ground (G1)</strong> and{" "}
              <strong className="font-semibold">Basement (B1 / B2)</strong> levels.
            </span>
          </div>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground">
        <span>Entrance</span>
        <span className="flex items-center gap-1 font-semibold text-primary">
          <Navigation className="size-3" /> One way
        </span>
        <span>Exit</span>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-surface/60 font-mono text-xs text-muted-foreground">
          <span className="live-dot" />
          <span>Loading live parking grid...</span>
        </div>
      ) : errorMsg ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-xs">
          <AlertCircle className="size-6 text-destructive" />
          <p className="font-medium text-foreground">{errorMsg}</p>
          <Button size="sm" variant="outline" onClick={fetchSlots} className="gap-1.5 text-xs">
            <RefreshCw className="size-3" /> Retry
          </Button>
        </div>
      ) : visibleSlots.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-surface/40 p-6 text-center text-xs text-muted-foreground">
          <CircleSlash2 className="size-6 opacity-40" />
          <p>No parking bays found for this filter.</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-surface/60 font-mono text-xs text-muted-foreground">
              <span className="live-dot" />
              <span>Rendering 3D Parking Grid...</span>
            </div>
          }
        >
          <ParkingGrid3D
            key={`${level}-${zone}`}
            slots={visibleSlots}
            selectedSlot={selected}
            onSelectSlot={choose}
            activeFloor={level}
            pulsing={pulsing}
          />
        </Suspense>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="road-lane my-4 flex h-14 items-center justify-around rounded-xl border-y border-dashed border-road-line/30 bg-road/75 text-road-line shadow-inner">
        <ArrowDown className="size-4 rotate-90" />
        <span className="font-mono text-[10px] uppercase tracking-widest font-semibold">
          Drive lane · 8 km/h
        </span>
        <ArrowDown className="size-4 rotate-90" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-y-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(["available", "maintenance", "selected"] as const).map((item) => (
            <span key={item} className="flex items-center gap-1.5 capitalize">
              <i
                className={cn(
                  "size-2 rounded-full",
                  item === "available"
                    ? "bg-available"
                    : item === "maintenance"
                      ? "bg-muted-foreground"
                      : "bg-selected",
                )}
              />
              {item}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {availabilityMap
            ? "Live availability based on selected time window"
            : "Live occupancy arrives with bookings"}
        </span>
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">{title}</h2>
      {copy && <p className="mt-4 max-w-xl leading-7 text-muted-foreground">{copy}</p>}
    </div>
  );
}
