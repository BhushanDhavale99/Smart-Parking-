import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  Bike,
  Bot,
  BookOpen,
  CalendarDays,
  Camera,
  CarFront,
  Check,
  ChevronDown,
  CircleGauge,
  Clock3,
  CreditCard,
  Database,
  Download,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Headphones,
  IndianRupee,
  LockKeyhole,
  MapPin,
  Navigation,
  Plus,
  RotateCw,
  ScanLine,
  ScrollText,
  ShieldCheck,
  SquareParking,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  WalletCards,
  Wifi,
  Zap,
  Accessibility,
} from "lucide-react";
import heroImage from "@/assets/parking-hero.jpg";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ParkingMap, SectionHeading, StatusBadge } from "@/components/parking-ui";
import { facility, facilities, parkingSlots, type ParkingSlotData } from "@/lib/parking-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Reveal } from "@/components/reveal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
/** Inline replay helper — avoids statically importing the 24 KB OpeningAnimation module */
function replayParkingIntro() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("parkgrid_seen_intro");
    window.dispatchEvent(new CustomEvent("replay-parking-intro"));
  }
}

import { ThemeSelector } from "@/components/ThemeSelector";
import { FAQ_CATEGORIES, FAQ_DATABASE, RAG_DOCUMENTS, type FAQCategory } from "@/lib/faq-rag-data";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useSetDefaultVehicle,
  useArchiveVehicle,
  type VehicleRow,
} from "@/hooks/useVehicles";
import {
  useAvailability,
  useQuoteBooking,
  useCreateBooking,
  useListMyBookings,
  useGetBooking,
  useCancellationPreview,
  useCancelBooking,
  type BookingRow,
  type MyBookingRow,
  type BookingStatus,
} from "@/hooks/useBookings";
import { usePayBooking, useGetReceipt, type PaymentRow } from "@/hooks/usePayments";
import type { PaymentMethod, TestScenario } from "@/lib/payments/provider";
import {
  createIstDateTime,
  alignToNext15Minutes,
  formatIstDateTime,
  formatIstDate,
  formatIstTime,
  formatPaise,
} from "@/lib/date-utils";
import type { LevelCode } from "@/lib/parking-data";
export { HelpCenterPage } from "@/components/HelpCenterPage";
export { ContactSupportPage } from "@/components/ContactSupportPage";
export { LoginPage } from "@/components/LoginPage";

const iconSet = [
  Camera,
  Activity,
  BatteryCharging,
  Accessibility,
  CreditCard,
  ScanLine,
  CircleGauge,
  Headphones,
];
export function HomePage() {
  return (
    <>
      <section className="relative flex min-h-[92vh] items-end overflow-hidden pt-24">
        <img
          src={heroImage}
          alt="Silver car entering the automated ParkGrid One facility"
          width={1600}
          height={1000}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-[1440px] gap-10 px-6 pb-12 lg:grid-cols-[1fr_420px] lg:px-10 lg:pb-20">
          <div className="page-reveal max-w-3xl self-end text-hero-foreground">
            <p className="mb-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]">
              <span className="live-dot" /> Live at BKC, Mumbai
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.98] sm:text-7xl lg:text-8xl">
              Smart parking.
              <br />
              <span className="text-hero-foreground">Simple. Fast.</span>{" "}
              <span className="text-primary">Secure.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-hero-muted sm:text-lg">
              Reserve a verified bay, enter with QR, and park without the search. ParkGrid One
              brings intelligent access, EV charging, and round-the-clock security to BKC, Mumbai.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/parking">
                <Button size="lg">
                  Book parking <ArrowRight />
                </Button>
              </Link>
              <Link to="/parking">
                <Button size="lg" variant="heroOutline">
                  Explore parking
                </Button>
              </Link>
            </div>
          </div>
          <div className="page-reveal glass-panel self-end p-5 text-hero-foreground [animation-delay:180ms] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-hero-muted">
                  Live availability
                </p>
                <p className="mt-1 font-display text-4xl font-semibold">
                  73 <span className="text-base font-normal text-hero-muted">spaces</span>
                </p>
              </div>
              <div className="availability-ring grid size-20 place-items-center rounded-full">
                <span className="font-mono text-sm">49%</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-hero-line pt-4">
              {[
                ["Occupied", "62", "text-occupied"],
                ["Reserved", "15", "text-reserved"],
                ["EV ready", "4", "text-ev"],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <strong className={cn("block font-display text-xl", tone)}>{value}</strong>
                  <span className="text-[10px] text-hero-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[10px] text-hero-muted">
              <span className="live-dot" /> Updated just now
            </p>
          </div>
        </div>
      </section>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-border px-6 sm:grid-cols-4 sm:divide-x sm:divide-y-0 lg:px-10">
          {[
            ["150", "Total slots"],
            ["73", "Available"],
            ["62", "Occupied"],
            ["15", "Reserved"],
          ].map(([value, label], i) => (
            <div key={label} className="px-5 py-8 first:pl-0">
              <div className="flex items-end justify-between">
                <strong
                  className={cn(
                    "font-display text-4xl",
                    i === 1 && "text-available",
                    i === 2 && "text-occupied",
                    i === 3 && "text-reserved",
                  )}
                >
                  {value}
                </strong>
                <CarFront className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
      {/* Stats → Live Map: subtle glow divider bridge */}
      <section className="stats-map-bridge py-20 lg:py-28">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div>
            <SectionHeading
              eyebrow="Live map · Floor 1"
              title="See where you'll park before you arrive."
              copy="Every bay reports its live state. Green spaces are ready now; choose one to begin your booking."
            />
            <Link to="/parking" className="mt-7 inline-block">
              <Button>
                View full parking map <ArrowRight />
              </Button>
            </Link>
          </div>
          <ParkingMap preview />
        </div>
      </section>
      <section className="border-y border-border bg-surface py-20 lg:py-28">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <SectionHeading
              eyebrow="The facility"
              title="Designed for a calmer arrival."
              copy="Three connected levels, smart guidance, and people on hand around the clock—built into one premium urban facility."
            />
            <div className="grid grid-cols-2 gap-px border border-border bg-border">
              {[
                ["BKC, Mumbai", "Maharashtra"],
                ["150 bays", "Across 3 floors"],
                ["Open 24/7", "Mon–Sun"],
                ["6 chargers", "60 kW fast charge"],
              ].map(([a, b]) => (
                <div key={a} className="bg-background p-5">
                  <strong className="block font-display text-xl">{a}</strong>
                  <span className="text-xs text-muted-foreground">{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map(([title, copy], i) => {
              const Icon = iconSet[i] ?? ShieldCheck;
              return (
                <article
                  key={title}
                  className="group interactive-lift border border-border bg-background p-5"
                >
                  <Icon className="size-6 text-primary transition group-hover:scale-110" />
                  <h3 className="mt-6 font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <SectionHeading eyebrow="One smooth journey" title="From plan to parked in five steps." />
          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {[
              "Choose date & time",
              "Select your slot",
              "Pay securely",
              "Get your QR pass",
              "Park easily",
            ].map((step, i) => (
              <div
                key={step}
                className="stagger-item relative border-t border-primary/40 pt-5"
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
              >
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <h3 className="mt-4 max-w-[10rem] font-display text-xl font-semibold">{step}</h3>
                {i < 4 && (
                  <ArrowRight className="absolute -right-3 top-[-9px] hidden size-4 text-primary md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function ParkingPage() {
  const initialSlot = parkingSlots.find((s) => s.status === "available");
  if (!initialSlot) return null;
  return <ParkingBooking initialSlot={initialSlot} />;
}

function ParkingBooking({ initialSlot }: { initialSlot: ParkingSlotData }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ParkingSlotData>(initialSlot);
  const [duration, setDuration] = useState(2);
  const todayIst = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  }, []);

  const getNowIstTime = useCallback(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  }, []);

  const getNext15MinIstTime = useCallback(() => {
    const next15 = alignToNext15Minutes(new Date());
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(next15);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "10";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  }, []);

  const [date, setDate] = useState(todayIst);
  const [arrival, setArrival] = useState(() => getNext15MinIstTime());
  const [level, setLevel] = useState<LevelCode>(initialSlot.levelCode ?? "G1");

  const isPastArrival = date === todayIst && arrival < getNowIstTime();

  const handleSlotsLoaded = useCallback((loaded: ParkingSlotData[]) => {
    if (loaded.length === 0) return;
    setSelected((prev) => {
      if (prev.slotId) return prev;
      const match =
        loaded.find((s) => s.code === (prev.code || prev.id)) ||
        loaded.find((s) => s.status === "available") ||
        loaded[0];
      return match ?? prev;
    });
  }, []);

  const startAtDate = useMemo(() => {
    try {
      return createIstDateTime(date, arrival);
    } catch {
      return new Date();
    }
  }, [date, arrival]);

  const endAtDate = useMemo(() => {
    const d = new Date(startAtDate);
    d.setHours(d.getHours() + duration);
    return d;
  }, [startAtDate, duration]);

  const startIso = startAtDate.toISOString();
  const endIso = endAtDate.toISOString();

  // Live availability for current slot & level across the selected time range
  const { data: availabilityData, isLoading: availabilityLoading } = useAvailability({
    start_at: startIso,
    end_at: endIso,
    level,
  });

  const availabilityMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (Array.isArray(availabilityData)) {
      for (const s of availabilityData) {
        map[s.slot_id] = s.is_available;
      }
    }
    return map;
  }, [availabilityData]);

  const isSelectedAvailable = useMemo(() => {
    if (!availabilityMap) return true;
    if (selected.slotId && availabilityMap[selected.slotId] !== undefined) {
      return availabilityMap[selected.slotId];
    }
    return true;
  }, [availabilityMap, selected]);

  // Server quote for the exact duration and slot
  const quoteQuery = useQuoteBooking(
    selected.slotId
      ? {
          slot_id: selected.slotId,
          start_at: startIso,
          end_at: endIso,
        }
      : null,
  );

  const fallbackBase = selected.hourlyRatePaise
    ? selected.hourlyRatePaise * duration
    : selected.price * duration * 100;
  const fallbackTax = Math.round(fallbackBase * 0.18);
  const fallbackTotal = fallbackBase + fallbackTax;

  const basePaise = quoteQuery.data?.base_paise ?? fallbackBase;
  const taxPaise = quoteQuery.data?.gst_paise ?? fallbackTax;
  const totalPaise = quoteQuery.data?.total_paise ?? fallbackTotal;

  const valid = Boolean(date && arrival && duration > 0 && isSelectedAvailable && !isPastArrival);

  const updateSlot = (slot: ParkingSlotData) => {
    setSelected(slot);
    if (slot.levelCode) setLevel(slot.levelCode);
    toast.success(`${slot.id} selected`);
  };

  const handleContinue = () => {
    if (!valid) return;
    const reservation = {
      slotId: selected.slotId || selected.id,
      slotCode: selected.code || selected.id,
      levelCode: selected.levelCode || level,
      slotType: selected.slotType || "standard",
      hourlyRatePaise: selected.hourlyRatePaise || selected.price * 100,
      startAt: startIso,
      endAt: endIso,
      durationHours: duration,
      date,
      arrival,
      basePaise,
      taxPaise,
      totalPaise,
    };
    if (typeof window !== "undefined") {
      sessionStorage.setItem("parkgrid_reservation", JSON.stringify(reservation));
    }
    navigate({ to: "/vehicles" });
  };

  return (
    <PageFrame
      eyebrow="Book a space"
      title="Choose your bay"
      copy="Live availability across all five facility levels."
    >
      <div className="mb-5 grid gap-3 border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="field-label">
          Date
          <input
            required
            type="date"
            min={todayIst}
            value={date}
            onChange={(event) => {
              const newDate = event.target.value;
              setDate(newDate);
              if (newDate === todayIst && arrival < getNowIstTime()) {
                setArrival(getNext15MinIstTime());
              }
            }}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Arrival
          <input
            required
            type="time"
            min={date === todayIst ? getNowIstTime() : undefined}
            value={arrival}
            onChange={(event) => setArrival(event.target.value)}
            className="field-input"
          />
          {isPastArrival && (
            <p className="mt-1 text-xs font-semibold text-destructive">
              Arrival time cannot be in the past.
            </p>
          )}
        </label>
        <label className="field-label">
          Duration
          <select
            required
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className="field-input"
          >
            <option value={1}>1 hour</option>
            <option value={2}>2 hours</option>
            <option value={4}>4 hours</option>
            <option value={8}>8 hours</option>
          </select>
        </label>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <ParkingMap
          onSelection={updateSlot}
          onSlotsLoaded={handleSlotsLoaded}
          availabilityMap={availabilityMap}
          level={level}
          onLevelChange={setLevel}
        />
        <aside className="space-y-4">
          <div key={selected.id} className="selection-pulse border border-border bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Selected bay
            </p>
            <div className="mt-3 flex items-center justify-between">
              <strong className="font-display text-4xl">{selected.id}</strong>
              <StatusBadge status={isSelectedAvailable ? "available" : "occupied"} />
            </div>
            {!isSelectedAvailable && (
              <p className="mt-2 text-xs font-semibold text-destructive">
                Bay occupied for selected window. Pick another bay.
              </p>
            )}
            <dl className="mt-5 grid gap-3 text-sm">
              <InfoRow label="Level" value={`Level ${selected.levelCode ?? level}`} />
              <InfoRow
                label="Zone"
                value={selected.zone === "EV" ? "EV charging" : `Zone ${selected.zone}`}
              />
              <InfoRow label="Vehicle" value={selected.type} />
              <InfoRow label="Rate" value={`₹${selected.price}/hour`} />
              <InfoRow
                label="Window"
                value={`${formatIstTime(startIso)} – ${formatIstTime(endIso)}`}
              />
            </dl>
          </div>
          <div className="sticky top-24 border border-primary/30 bg-primary/5 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Booking summary
            </p>
            <div className="price-pop mt-5 space-y-3 text-sm" aria-live="polite">
              <InfoRow label="Parking base" value={formatPaise(basePaise)} />
              <InfoRow label="GST (18%)" value={formatPaise(taxPaise)} />
              <div className="border-t border-border pt-4">
                <InfoRow label="Total" value={formatPaise(totalPaise)} strong />
              </div>
            </div>
            {valid ? (
              <Button size="lg" className="mt-5 w-full" onClick={handleContinue}>
                Continue <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <Button size="lg" className="mt-5 w-full" disabled>
                {!isSelectedAvailable ? "Bay unavailable" : "Complete booking details"}
              </Button>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <LockKeyhole className="size-3" /> Secure checkout
            </p>
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}

export function FacilitiesPage() {
  return (
    <PageFrame
      eyebrow="Everything on site"
      title="A facility built around people and vehicles."
      copy="From entry guidance to charging and safety, every service is available at ParkGrid One."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facilities.map(([title, copy], i) => {
          const Icon = iconSet[i] ?? ShieldCheck;
          return (
            <article key={title} className="interactive-lift border border-border bg-surface p-6">
              <Icon className="size-7 text-primary" />
              <h2 className="mt-8 font-display text-xl font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
              <span className="mt-8 flex items-center gap-1 font-mono text-[10px] uppercase text-available">
                <Check className="size-3" /> Available now
              </span>
            </article>
          );
        })}
      </div>
    </PageFrame>
  );
}

const vehicleFormSchema = z
  .object({
    plate_number: z
      .string()
      .trim()
      .min(6, "Plate number must be at least 6 characters")
      .max(12, "Plate number cannot exceed 12 characters")
      .regex(/^[A-Za-z0-9]+$/, "Plate number can only contain letters and numbers"),
    vehicle_type: z.enum(["car", "suv", "bike", "ev"]),
    make: z.string().trim().max(50, "Make cannot exceed 50 characters").optional(),
    model: z.string().trim().max(50, "Model cannot exceed 50 characters").optional(),
    color: z.string().trim().max(30, "Color cannot exceed 30 characters").optional(),
    is_ev: z.boolean(),
    connector_type: z.enum(["CCS2", "Type2", "CHAdeMO", "Bharat_AC001", "Bharat_DC001"]).nullable(),
    is_default: z.boolean(),
  })
  .superRefine((val, ctx) => {
    const isEv = val.is_ev || val.vehicle_type === "ev";
    if (isEv && !val.connector_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select an EV connector type",
        path: ["connector_type"],
      });
    }
  });

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export function VehiclesPage() {
  const navigate = useNavigate();
  const { data: vehicles = [], isLoading, isError, error, refetch } = useVehicles();
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();
  const setDefaultMutation = useSetDefaultVehicle();
  const archiveMutation = useArchiveVehicle();

  const [selected, setSelected] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<VehicleRow | null>(null);

  // Auto-select default or first vehicle when vehicles load
  useEffect(() => {
    if (!selected && vehicles.length > 0) {
      const defaultVeh = vehicles.find((v) => v.is_default) ?? vehicles[0];
      if (defaultVeh) setSelected(defaultVeh.plate_number);
    }
  }, [vehicles, selected]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plate_number: "",
      vehicle_type: "car",
      make: "",
      model: "",
      color: "",
      is_ev: false,
      connector_type: null,
      is_default: false,
    },
  });

  const watchType = watch("vehicle_type");
  const watchIsEv = watch("is_ev");

  // Synchronize is_ev when vehicle_type is "ev"
  useEffect(() => {
    if (watchType === "ev" && !watchIsEv) {
      setValue("is_ev", true);
    }
  }, [watchType, watchIsEv, setValue]);

  const openAddModal = () => {
    setEditingVehicle(null);
    reset({
      plate_number: "",
      vehicle_type: "car",
      make: "",
      model: "",
      color: "",
      is_ev: false,
      connector_type: null,
      is_default: vehicles.length === 0,
    });
    setDialogOpen(true);
  };

  const openEditModal = (vehicle: VehicleRow) => {
    setEditingVehicle(vehicle);
    reset({
      plate_number: vehicle.plate_number,
      vehicle_type: vehicle.vehicle_type,
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      color: vehicle.color ?? "",
      is_ev: vehicle.is_ev,
      connector_type: vehicle.connector_type,
      is_default: vehicle.is_default,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: VehicleFormValues) => {
    try {
      const isEv = values.is_ev || values.vehicle_type === "ev";
      const payload = {
        plate_number: values.plate_number.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        vehicle_type: values.vehicle_type,
        make: values.make?.trim() || null,
        model: values.model?.trim() || null,
        color: values.color?.trim() || null,
        is_ev: isEv,
        connector_type: isEv && values.connector_type ? values.connector_type : null,
        is_default: values.is_default,
      };

      if (editingVehicle) {
        await updateMutation.mutateAsync({
          id: editingVehicle.id,
          ...payload,
        });
        toast.success("Vehicle updated successfully");
      } else {
        await createMutation.mutateAsync(payload);
        setSelected(payload.plate_number);
        toast.success("Vehicle added to your garage");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save vehicle";
      toast.error(msg);
    }
  };

  const handleSetDefault = async (id: string, plate: string) => {
    try {
      await setDefaultMutation.mutateAsync(id);
      toast.success(`${plate} is now your default vehicle`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set default vehicle";
      toast.error(msg);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    try {
      await archiveMutation.mutateAsync(target.id);
      if (selected === target.plate_number) {
        const remaining = vehicles.filter((v) => v.id !== target.id);
        const next = remaining.find((v) => v.is_default) ?? remaining[0];
        setSelected(next?.plate_number ?? "");
      }
      toast.success(`Vehicle ${target.plate_number} archived`);
      setArchiveTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to archive vehicle";
      toast.error(msg);
    }
  };

  return (
    <PageFrame
      eyebrow="Your garage"
      title="Choose a vehicle"
      copy="We'll match your vehicle to the right bay dimensions and services."
    >
      {/* ── Error State with Retry ── */}
      {isError && (
        <div className="mb-6 border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h3 className="mt-3 font-display text-lg">Unable to load your vehicles</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw className="mr-2 size-4" /> Try again
          </Button>
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="border border-border bg-surface/50 p-6 animate-pulse">
              <div className="size-10 rounded bg-muted/40" />
              <div className="mt-8 h-6 w-3/4 rounded bg-muted/40" />
              <div className="mt-2 h-4 w-1/2 rounded bg-muted/40" />
              <div className="mt-6 flex gap-2">
                <div className="h-9 w-24 rounded bg-muted/40" />
                <div className="h-9 w-9 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Vehicles Grid / Empty State ── */}
      {!isLoading && !isError && (
        <>
          {vehicles.length === 0 ? (
            <div className="border border-dashed border-border p-12 text-center bg-surface/30">
              <CarFront className="mx-auto size-12 text-muted-foreground/60" />
              <h3 className="mt-4 font-display text-xl">No vehicles registered yet</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Register your vehicle to automate bay selection, access EV chargers, and speed up
                checkout.
              </p>
              <Button className="mt-6" onClick={openAddModal}>
                <Plus className="mr-2 size-4" /> Register vehicle
              </Button>
            </div>
          ) : (
            <div
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              role="radiogroup"
              aria-label="Saved vehicles"
            >
              {vehicles.map((vehicle) => {
                const isSelected = selected === vehicle.plate_number;
                const isEvVehicle = vehicle.is_ev || vehicle.vehicle_type === "ev";
                const title =
                  vehicle.make && vehicle.model
                    ? `${vehicle.make} ${vehicle.model}`
                    : vehicle.make || vehicle.model || vehicle.vehicle_type.toUpperCase();

                return (
                  <article
                    key={vehicle.id}
                    className={cn(
                      "interactive-lift relative border bg-surface p-6 transition-all",
                      isSelected
                        ? "border-selected shadow-[0_0_24px_var(--selected-glow)]"
                        : "border-border",
                    )}
                  >
                    {vehicle.is_default && (
                      <div className="absolute right-4 top-4">
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-primary border border-primary/20">
                          <Star className="size-3 fill-primary" /> Default
                        </span>
                      </div>
                    )}

                    {isEvVehicle ? (
                      <Zap className="size-10 text-primary" />
                    ) : vehicle.vehicle_type === "bike" ? (
                      <Bike className="size-10 text-primary" />
                    ) : (
                      <CarFront className="size-10 text-primary" />
                    )}

                    <h2 className="mt-7 font-display text-2xl truncate" title={title}>
                      {title}
                    </h2>
                    <p className="mt-1 font-mono text-sm tracking-wider font-semibold">
                      {vehicle.plate_number}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {vehicle.vehicle_type === "ev" ? "EV" : vehicle.vehicle_type}
                      </span>
                      {vehicle.color && <span>• {vehicle.color}</span>}
                      {isEvVehicle && vehicle.connector_type && (
                        <span className="text-primary font-mono text-[11px]">
                          • {vehicle.connector_type}
                        </span>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-2 border-t border-border/40 pt-4">
                      <div className="flex items-center gap-2">
                        <Button
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setSelected(vehicle.plate_number)}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                        >
                          {isSelected ? "Selected" : "Select"}
                        </Button>
                        {!vehicle.is_default && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleSetDefault(vehicle.id, vehicle.plate_number)}
                            disabled={setDefaultMutation.isPending}
                          >
                            Make default
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${title}`}
                          onClick={() => openEditModal(vehicle)}
                          className="size-8"
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Archive ${title}`}
                          onClick={() => setArchiveTarget(vehicle)}
                          className="size-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Add vehicle card (if below 5 vehicle limit) */}
              {vehicles.length < 5 && (
                <button
                  type="button"
                  className="add-vehicle-empty"
                  onClick={openAddModal}
                  aria-label="Add a new vehicle"
                >
                  <Plus className="size-10" strokeWidth={1.5} />
                  <span className="text-sm font-medium">Add vehicle</span>
                </button>
              )}
            </div>
          )}

          {vehicles.length >= 5 && (
            <p className="mt-4 text-xs text-muted-foreground">
              You have registered the maximum of 5 active vehicles allowed per account.
            </p>
          )}
        </>
      )}

      {/* ── Continue Flow ── */}
      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          disabled={!selected}
          onClick={() => {
            const chosenVehicle = vehicles.find(
              (v) => v.plate_number === selected || v.id === selected,
            );
            if (typeof window !== "undefined" && chosenVehicle) {
              const raw = sessionStorage.getItem("parkgrid_reservation");
              const current = raw ? JSON.parse(raw) : {};
              current.vehicleId = chosenVehicle.id;
              current.vehiclePlate = chosenVehicle.plate_number;
              current.vehicleType = chosenVehicle.vehicle_type;
              sessionStorage.setItem("parkgrid_reservation", JSON.stringify(current));
            }
            navigate({ to: "/checkout" });
          }}
        >
          Continue to checkout{" "}
          <ArrowRight className="transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      {/* ── Add / Edit Vehicle Modal ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{editingVehicle ? "Edit vehicle" : "Register a vehicle"}</DialogTitle>
              <DialogDescription>
                Provide your vehicle details for bay clearance and charging compatibility.
              </DialogDescription>
            </DialogHeader>

            <div className="my-5 grid gap-4 text-left">
              {/* Registration Plate */}
              <label className="field-label">
                Registration plate *
                <input
                  required
                  className="field-input font-mono uppercase"
                  placeholder="MH12AB1234"
                  maxLength={12}
                  {...register("plate_number", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    },
                  })}
                />
                {errors.plate_number && (
                  <span className="text-xs text-destructive">{errors.plate_number.message}</span>
                )}
              </label>

              {/* Vehicle Type */}
              <label className="field-label">
                Vehicle type *
                <select className="field-input" {...register("vehicle_type")}>
                  <option value="car">Car (Sedan / Hatchback)</option>
                  <option value="suv">SUV / MUV</option>
                  <option value="bike">Two-Wheeler / Bike</option>
                  <option value="ev">Electric Vehicle (EV)</option>
                </select>
                {errors.vehicle_type && (
                  <span className="text-xs text-destructive">{errors.vehicle_type.message}</span>
                )}
              </label>

              {/* Make & Model */}
              <div className="grid grid-cols-2 gap-3">
                <label className="field-label">
                  Make
                  <input
                    className="field-input"
                    placeholder="e.g. BMW, Tata"
                    maxLength={50}
                    {...register("make")}
                  />
                  {errors.make && (
                    <span className="text-xs text-destructive">{errors.make.message}</span>
                  )}
                </label>
                <label className="field-label">
                  Model
                  <input
                    className="field-input"
                    placeholder="e.g. 3 Series, Nexon"
                    maxLength={50}
                    {...register("model")}
                  />
                  {errors.model && (
                    <span className="text-xs text-destructive">{errors.model.message}</span>
                  )}
                </label>
              </div>

              {/* Color */}
              <label className="field-label">
                Color
                <input
                  className="field-input"
                  placeholder="e.g. Alpine White, Grey"
                  maxLength={30}
                  {...register("color")}
                />
                {errors.color && (
                  <span className="text-xs text-destructive">{errors.color.message}</span>
                )}
              </label>

              {/* EV Checkbox & Connector Dropdown */}
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    {...register("is_ev")}
                    disabled={watchType === "ev"}
                  />
                  <span>This is an electric vehicle (EV)</span>
                </label>

                {(watchIsEv || watchType === "ev") && (
                  <label className="field-label mt-2">
                    Fast-charging connector type *
                    <select className="field-input" {...register("connector_type")}>
                      <option value="">Select connector...</option>
                      <option value="CCS2">CCS2 (European / Indian Standard)</option>
                      <option value="Type2">Type 2 (AC Slow/Fast)</option>
                      <option value="CHAdeMO">CHAdeMO (Japanese Standard)</option>
                      <option value="Bharat_DC001">Bharat DC-001</option>
                      <option value="Bharat_AC001">Bharat AC-001</option>
                    </select>
                    {errors.connector_type && (
                      <span className="text-xs text-destructive">
                        {errors.connector_type.message}
                      </span>
                    )}
                  </label>
                )}
              </div>

              {/* Default Vehicle Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  {...register("is_default")}
                />
                <span>Set as default vehicle for quick reservations</span>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {editingVehicle ? "Update vehicle" : "Register vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Archive Confirmation Modal ── */}
      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.plate_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This vehicle will be removed from your active garage. Past bookings, parking passes,
              and payment receipts will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep vehicle</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive vehicle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const createBookingMutation = useCreateBooking();
  const payBookingMutation = usePayBooking();

  const [reservation, setReservation] = useState<{
    slotId: string;
    slotCode: string;
    levelCode: string;
    startAt: string;
    endAt: string;
    durationHours: number;
    basePaise: number;
    taxPaise: number;
    totalPaise: number;
    vehicleId?: string;
    vehiclePlate?: string;
  } | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("upi");
  const [testScenario, setTestScenario] = useState<TestScenario>("success");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [processing, setProcessing] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(600); // 10 minute display timer
  const [attemptCount, setAttemptCount] = useState(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [reservedBookingId, setReservedBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlBookingId = urlParams.get("bookingId");

      const raw = sessionStorage.getItem("parkgrid_reservation");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setReservation(parsed);
          if (parsed.vehicleId) {
            setSelectedVehicleId(parsed.vehicleId);
          }
          if (parsed.bookingId || urlBookingId) {
            setReservedBookingId(parsed.bookingId || urlBookingId);
          }
        } catch {
          // ignore parsing error
        }
      } else if (urlBookingId) {
        setReservedBookingId(urlBookingId);
      }
    }
  }, []);

  // Set default vehicle if none is selected yet
  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      const def = vehicles.find((v) => v.is_default) ?? vehicles[0];
      if (def) setSelectedVehicleId(def.id);
    }
  }, [selectedVehicleId, vehicles]);

  // Hold timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setHoldSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          toast.error("Reservation hold has expired. Please select a parking space again.");
          navigate({ to: "/parking" });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  const currentVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId);
  }, [vehicles, selectedVehicleId]);

  // Fallbacks if user navigated directly to /checkout
  const now = useMemo(() => new Date(), []);
  const fallbackStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString();
  }, [now]);
  const fallbackEnd = useMemo(() => {
    const d = new Date(fallbackStart);
    d.setHours(d.getHours() + 2);
    return d.toISOString();
  }, [fallbackStart]);

  const activeSlotId = reservation?.slotId || "00000000-0000-0000-0000-000000000001";
  const activeSlotCode = reservation?.slotCode || "G1-A01";
  const activeLevel = reservation?.levelCode || "G1";
  const activeStartAt = reservation?.startAt || fallbackStart;
  const activeEndAt = reservation?.endAt || fallbackEnd;
  const activeDuration = reservation?.durationHours || 2;
  const activeBasePaise = reservation?.basePaise || 10000;
  const activeTaxPaise = reservation?.taxPaise || 1800;
  const activeTotalPaise = reservation?.totalPaise || 11800;

  const holdMinutes = Math.floor(holdSeconds / 60);
  const holdRemainderSecs = holdSeconds % 60;

  const pay = async () => {
    if (processing) return;

    if (holdSeconds <= 0) {
      toast.error("Your reservation hold has expired. Please select a space again.");
      navigate({ to: "/parking" });
      return;
    }

    if (attemptCount >= 3) {
      toast.error("Maximum payment attempts reached. Please reserve another bay.");
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("parkgrid_reservation");
      }
      navigate({ to: "/parking" });
      return;
    }

    if (!selectedVehicleId && vehicles.length === 0) {
      toast.error("Please add a vehicle before checking out.");
      navigate({ to: "/vehicles" });
      return;
    }
    const vehicleIdToUse = selectedVehicleId || vehicles[0]?.id;
    if (!vehicleIdToUse) {
      toast.error("Please select a vehicle.");
      return;
    }

    setProcessing(true);
    setPaymentError(null);

    try {
      let bookingIdToPay = reservedBookingId;

      // 1. If not yet reserved on server, create reservation
      if (!bookingIdToPay) {
        const booking = await createBookingMutation.mutateAsync({
          slot_id: activeSlotId,
          vehicle_id: vehicleIdToUse,
          start_at: activeStartAt,
          end_at: activeEndAt,
        });
        bookingIdToPay = booking.id;
        setReservedBookingId(booking.id);
        if (typeof window !== "undefined") {
          const raw = sessionStorage.getItem("parkgrid_reservation");
          const cur = raw ? JSON.parse(raw) : {};
          cur.bookingId = booking.id;
          sessionStorage.setItem("parkgrid_reservation", JSON.stringify(cur));
        }
      }

      // 2. Process payment via provider (atomic pay_for_booking RPC)
      // When bookingId exists, we ONLY call payBooking with a fresh idempotency key
      const result = await payBookingMutation.mutateAsync({
        booking_id: bookingIdToPay,
        method: selectedMethod,
        idempotency_key: idempotencyKey,
        test_scenario: testScenario,
      });

      const { payment: paidPayment, booking: updatedBooking } = result;

      if (paidPayment.status === "succeeded") {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("parkgrid_last_booking_id", updatedBooking.id);
          sessionStorage.setItem("parkgrid_last_booking", JSON.stringify(updatedBooking));
          sessionStorage.setItem("parkgrid_last_payment", JSON.stringify(paidPayment));
          sessionStorage.removeItem("parkgrid_reservation");
        }

        toast.success(`Payment confirmed! Receipt: ${paidPayment.receipt_number}`);
        navigate({
          to: "/confirmation",
          search: { bookingId: updatedBooking.id },
        });
      } else {
        // Payment failed in real provider simulation scenario (decline, insufficient_funds, timeout)
        const nextAttempts = attemptCount + 1;
        setAttemptCount(nextAttempts);
        setIdempotencyKey(crypto.randomUUID()); // Fresh key for retry attempt

        const failureMsg = paidPayment.failure_reason || "Payment declined by issuing bank.";
        setPaymentError(
          nextAttempts >= 3
            ? `${failureMsg} (3/3 attempts failed: Reservation hold cancelled)`
            : `${failureMsg} (Attempt ${nextAttempts} of 3. You may retry.)`,
        );
        toast.error(failureMsg);
        if (nextAttempts >= 3) {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("parkgrid_reservation");
          }
          navigate({ to: "/parking" });
        }
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let msg = rawMsg;
      if (rawMsg.startsWith("[") || rawMsg.startsWith("{")) {
        msg = "Something went wrong with this booking. Please go back and try again.";
      }

      if (
        msg.includes("23P01") ||
        msg.includes("exclusion") ||
        msg.includes("already reserved") ||
        msg.includes("slot_not_available") ||
        msg.includes("just taken")
      ) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("parkgrid_reservation");
        }
        toast.error("This bay was just reserved by another driver. Please choose another space.", {
          duration: 6000,
        });
        navigate({ to: "/parking" });
      } else if (msg.includes("expired") || msg.includes("Reservation hold")) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("parkgrid_reservation");
        }
        toast.error("Reservation hold has expired. Please select a parking space again.");
        navigate({ to: "/parking" });
      } else if (msg.includes("ended") || msg.includes("already ended")) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("parkgrid_reservation");
        }
        toast.error("Booking period has already ended. Please select a new time.");
        navigate({ to: "/parking" });
      } else if (msg.includes("Maximum payment attempts") || msg.includes("exceeded")) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("parkgrid_reservation");
        }
        toast.error("Maximum payment attempts reached. Please reserve another bay.");
        navigate({ to: "/parking" });
      } else {
        // Internal or validation errors do NOT increment attemptCount!
        setIdempotencyKey(crypto.randomUUID());
        setPaymentError(msg || "Could not complete booking payment.");
        toast.error(msg || "Payment processing error.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods: Array<{
    id: PaymentMethod;
    name: string;
    detail: string;
  }> = [
    { id: "upi", name: "UPI / QR", detail: "Google Pay, PhonePe, Paytm, BHIM" },
    { id: "card", name: "Credit / Debit Card", detail: "Visa, Mastercard, RuPay, Amex" },
    { id: "netbanking", name: "Net Banking", detail: "HDFC, ICICI, SBI, Axis & 40+ banks" },
    { id: "wallet", name: "Mobile Wallet", detail: "Paytm, Amazon Pay, Mobikwik" },
  ];

  return (
    <PageFrame eyebrow="Secure checkout" title="Review and pay">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {/* Parking Details Card */}
          <div className="border border-border bg-surface p-6">
            <h2 className="font-display text-2xl">Parking details</h2>
            <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2">
              <div className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">Facility</span>
                <strong className="mt-1 block text-sm">{facility.name}</strong>
              </div>
              <div className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">Slot & Level</span>
                <strong className="mt-1 block text-sm">
                  {activeSlotCode} · Level {activeLevel}
                </strong>
              </div>
              <div className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">Date</span>
                <strong className="mt-1 block text-sm">{formatIstDate(activeStartAt)}</strong>
              </div>
              <div className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">Arrival Window</span>
                <strong className="mt-1 block text-sm">
                  {formatIstTime(activeStartAt)} – {formatIstTime(activeEndAt)}
                </strong>
              </div>
              <div className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">Duration</span>
                <strong className="mt-1 block text-sm">{activeDuration} hours</strong>
              </div>
              <div className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">Assigned Vehicle</span>
                {vehicles.length > 0 ? (
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="mt-1 w-full bg-transparent font-mono text-xs font-semibold focus:outline-none"
                    aria-label="Select registered vehicle"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id} className="bg-surface text-foreground">
                        {v.plate_number} ({v.make ? `${v.make} ` : ""}
                        {v.vehicle_type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Link to="/vehicles" className="mt-1 block text-xs text-primary underline">
                    + Add vehicle
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 border border-available/30 bg-available/5 p-4">
              <ShieldCheck className="size-6 text-available" />
              <p className="text-sm">
                <strong className="block">Your space is held</strong>
                <span className="text-muted-foreground">
                  Hold timer: {holdMinutes}:{holdRemainderSecs.toString().padStart(2, "0")}{" "}
                  remaining. Complete payment to confirm.
                </span>
              </p>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Payment method</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                Encrypted · 256-Bit
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Select how you would like to pay. No real credentials or PINs are stored.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {paymentMethods.map((m) => {
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethod(m.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                        : "border-border bg-surface/60 hover:border-border/80 hover:bg-surface",
                    )}
                  >
                    <div
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-md border text-xs font-bold",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      <CreditCard className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{m.name}</span>
                        {isSelected && <Check className="size-3 text-primary" />}
                      </div>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {m.detail}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mock Gateway Test Scenario Tool */}
            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    Mock Test Gateway Sandbox
                  </span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">
                  (payment_mode: mock)
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Simulate different gateway responses. In production, Razorpay seamlessly replaces
                this selector.
              </p>
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-foreground">
                  Select outcome scenario for this attempt:
                </label>
                <select
                  value={testScenario}
                  onChange={(e) => setTestScenario(e.target.value as TestScenario)}
                  disabled={processing}
                  className="mt-1.5 w-full rounded border border-border bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
                  aria-label="Payment test scenario"
                >
                  <option value="success">
                    Success — Transaction approved & booking confirmed
                  </option>
                  <option value="decline">Decline — Card/bank declined by issuer</option>
                  <option value="insufficient_funds">
                    Insufficient Funds — Account balance too low
                  </option>
                  <option value="timeout">Timeout — Gateway network session timed out</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Price Summary and Action */}
        <div className="h-fit border border-primary/30 bg-primary/5 p-6">
          <h2 className="font-display text-2xl">Price summary</h2>
          <div className="mt-6 space-y-4">
            <InfoRow label="Parking base" value={formatPaise(activeBasePaise)} />
            <InfoRow label="GST (18%)" value={formatPaise(activeTaxPaise)} />
            <div className="border-t border-border pt-5">
              <InfoRow label="Total" value={formatPaise(activeTotalPaise)} strong />
            </div>
          </div>

          {paymentError && (
            <div className="mt-5 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4 shrink-0" />
                <span>Payment Unsuccessful</span>
              </div>
              <p className="mt-1 leading-relaxed">{paymentError}</p>
            </div>
          )}

          {attemptCount >= 3 ? (
            <div className="mt-6 space-y-3">
              <p className="text-center text-xs text-destructive">
                Reservation hold cancelled due to 3 failed payment attempts.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: "/parking" })}
              >
                Choose Another Space
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="mt-7 w-full"
              loading={processing}
              disabled={processing || vehiclesLoading || vehicles.length === 0}
              onClick={pay}
            >
              <LockKeyhole />{" "}
              {processing
                ? "Authorizing with gateway..."
                : attemptCount > 0
                  ? `Retry Payment (${formatPaise(activeTotalPaise)})`
                  : `Pay ${formatPaise(activeTotalPaise)}`}
            </Button>
          )}

          <div
            className="mt-4 space-y-1.5 text-center text-[10px] text-muted-foreground"
            aria-live="polite"
          >
            <p>
              {processing
                ? "Connecting to gateway sandbox & verifying idempotency key…"
                : `Paying with ${selectedMethod.toUpperCase()} · Attempt ${attemptCount + 1} of 3`}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground/70">
              Idempotency: {idempotencyKey.slice(0, 8)}…
            </p>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

export function ConfirmationPage() {
  const [bookingId, setBookingId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const idFromUrl = urlParams.get("bookingId");
      const storedId = sessionStorage.getItem("parkgrid_last_booking_id");
      setBookingId(idFromUrl || storedId || "");
    }
  }, []);

  const { data: booking } = useGetBooking(bookingId || undefined);
  const { data: receiptPayment } = useGetReceipt({ booking_id: bookingId || undefined });

  const cachedBooking = useMemo(() => {
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("parkgrid_last_booking");
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // ignore error
        }
      }
    }
    return null;
  }, []);

  const cachedPayment = useMemo(() => {
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("parkgrid_last_payment");
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // ignore error
        }
      }
    }
    return null;
  }, []);

  const active = booking || cachedBooking;
  const refCode = active?.reference || "SP-CONFIRMED";
  const slotCode = active?.parking_slots?.code || "A12";
  const levelCode = active?.parking_slots?.level_code || "G1";
  const plate = active?.plate_snapshot || active?.vehicles?.plate_number || "MH12AB1234";
  const startAt = active?.start_at || new Date().toISOString();
  const endAt = active?.end_at || new Date(Date.now() + 7200000).toISOString();
  const dateStr = formatIstDate(startAt);
  const timeStr = `${formatIstTime(startAt)} – ${formatIstTime(endAt)}`;

  // Financial figures
  const receiptNumber =
    receiptPayment?.receipt_number || cachedPayment?.receipt_number || "RC-PROCESSING";
  const baseAmount = receiptPayment?.base_paise ?? active?.base_paise ?? 10000;
  const gstAmount = receiptPayment?.gst_paise ?? active?.gst_paise ?? 1800;
  const totalAmount = receiptPayment?.amount_paise ?? active?.total_paise ?? 11800;
  const paymentMethod = (receiptPayment?.method ?? cachedPayment?.method ?? "upi").toUpperCase();
  const providerRef =
    receiptPayment?.provider_ref ?? cachedPayment?.provider_ref ?? "MOCK-CONFIRMED";
  const paymentTime =
    receiptPayment?.created_at ?? cachedPayment?.created_at ?? active?.created_at ?? startAt;

  const saveFile = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(refCode);
      setCopied(true);
      toast.success("Booking reference copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy was blocked", { description: `Booking Ref: ${refCode}` });
    }
  };

  const download = () => {
    setDownloading(true);
    saveFile(
      `${refCode}.txt`,
      `PARKGRID ONE TAX INVOICE & PARKING PASS
Receipt Number: ${receiptNumber}
Booking Ref: ${refCode}
Payment Method: ${paymentMethod} (${providerRef})
Slot: ${slotCode} (Floor Level ${levelCode})
Arrival: ${formatIstDateTime(startAt)}
Departure: ${formatIstDateTime(endAt)}
Vehicle Plate: ${plate}
---------------------------------------------
Parking Base Charge: ${formatPaise(baseAmount)}
CGST (9%): ${formatPaise(Math.round(gstAmount / 2))}
SGST (9%): ${formatPaise(Math.round(gstAmount / 2))}
Total GST (18%): ${formatPaise(gstAmount)}
---------------------------------------------
Total Paid: ${formatPaise(totalAmount)}
Time of Payment: ${formatIstDateTime(paymentTime)}
Status: CONFIRMED (PAID)`,
      `text/plain`,
    );
    window.setTimeout(() => setDownloading(false), 700);
    toast.success("Parking pass & receipt downloaded");
  };

  const calendar = () => {
    const formatIcsTime = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    saveFile(
      `${refCode}.ics`,
      [
        `BEGIN:VCALENDAR`,
        `VERSION:2.0`,
        `PRODID:-//ParkGrid One//Booking//EN`,
        `BEGIN:VEVENT`,
        `UID:${refCode}@parkgrid.one`,
        `DTSTAMP:${formatIcsTime(new Date().toISOString())}`,
        `DTSTART:${formatIcsTime(startAt)}`,
        `DTEND:${formatIcsTime(endAt)}`,
        `SUMMARY:Parking at ParkGrid One - Bay ${slotCode}`,
        `LOCATION:${facility.address}`,
        `DESCRIPTION:Parking bay ${slotCode} reserved for vehicle ${plate}. Receipt: ${receiptNumber}. Booking Ref: ${refCode}`,
        `END:VEVENT`,
        `END:VCALENDAR`,
      ].join("\r\n"),
      `text/calendar`,
    );
    toast.success("Calendar event downloaded");
  };

  return (
    <PageFrame eyebrow="Payment successful" title="Booking confirmed">
      <div className="page-reveal mx-auto max-w-3xl border border-available/30 bg-surface p-6 text-center sm:p-10">
        <span className="success-check mx-auto grid size-16 place-items-center rounded-full bg-available/12 text-available">
          <Check className="size-8" />
        </span>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <p className="font-mono text-xs uppercase text-muted-foreground">
            Booking Ref · {refCode}
          </p>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy booking reference"
            onClick={copyId}
            success={copied}
          >
            {!copied && <Copy />}
          </Button>
        </div>
        <h2 className="mt-2 font-display text-5xl">{slotCode}</h2>
        <p className="mt-2 text-muted-foreground">
          {dateStr} · {timeStr} · Floor {levelCode}
        </p>

        {/* GST Tax Invoice & Receipt Summary */}
        <div className="mt-6 rounded-lg border border-border bg-background/80 p-5 text-left text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                Official GST Tax Receipt
              </span>
              <strong className="block font-mono text-sm text-foreground">{receiptNumber}</strong>
            </div>
            <div className="text-right">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                Payment Status
              </span>
              <span className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-500">
                <Check className="size-3" /> PAID · {providerRef}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 font-mono text-muted-foreground">
            <div className="flex justify-between">
              <span>Base Parking Charge:</span>
              <span className="text-foreground">{formatPaise(baseAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>CGST (9%):</span>
              <span className="text-foreground">{formatPaise(Math.round(gstAmount / 2))}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST (9%):</span>
              <span className="text-foreground">{formatPaise(Math.round(gstAmount / 2))}</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-semibold text-foreground">
              <span>Total Paid ({paymentMethod}):</span>
              <span className="text-sm font-bold text-emerald-500">{formatPaise(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="qr-shell relative mx-auto mt-8 w-fit bg-qr p-5 text-qr-foreground">
          <QRCodeSVG value={refCode} size={184} />
          <span className="qr-scan-line" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Scan at the entry gate</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link to="/bookings">
            <Button>View my bookings</Button>
          </Link>
          <Button variant="outline" loading={downloading} onClick={download}>
            {!downloading && <Download />} {downloading ? "Preparing" : "Download pass & receipt"}
          </Button>
          <Button variant="outline" onClick={calendar}>
            <CalendarDays /> Add to calendar
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {copied ? "Booking reference copied" : ""}
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <CarFront className="car-park-animation size-6 text-primary" />
          <span>Gate</span>
          <ArrowRight className="size-3" />
          <span className="border border-selected/50 bg-selected/10 px-3 py-2 font-mono font-bold text-selected">
            {slotCode}
          </span>
        </div>
      </div>
    </PageFrame>
  );
}

export function BookingsPage() {
  const [tab, setTab] = useState<"Upcoming" | "Active" | "Completed" | "Cancelled">("Upcoming");
  const tabs = ["Upcoming", "Active", "Completed", "Cancelled"] as const;

  const mappedStatus = useMemo(() => {
    switch (tab) {
      case "Upcoming":
        return "confirmed" as BookingStatus;
      case "Active":
        return "active" as BookingStatus;
      case "Completed":
        return "completed" as BookingStatus;
      case "Cancelled":
        return "cancelled" as BookingStatus;
    }
  }, [tab]);

  const { data, isLoading, refetch } = useListMyBookings(tab);
  const bookings = data?.bookings ?? [];

  // Cancellation modal state
  const [cancelTarget, setCancelTarget] = useState<MyBookingRow | null>(null);
  const cancelMutation = useCancelBooking();
  const { data: cancelPreview, isLoading: previewLoading } = useCancellationPreview(
    cancelTarget?.id ?? undefined,
  );

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      const res = await cancelMutation.mutateAsync({
        booking_id: cancelTarget.id,
      });
      const refundPaise = res?.refund_paise ?? cancelPreview?.refund_paise ?? 0;
      toast.success(
        refundPaise > 0
          ? `Booking cancelled. Refund of ${formatPaise(refundPaise)} initiated.`
          : "Booking cancelled.",
      );
      setCancelTarget(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking");
    }
  };

  return (
    <PageFrame eyebrow="Your parking" title="My bookings">
      <div
        className="relative mb-6 flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Booking status"
      >
        {tabs.map((t) => (
          <Button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls="booking-panel"
            variant="ghost"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-none border-b-2 transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent",
            )}
          >
            {t}
          </Button>
        ))}
      </div>
      <div id="booking-panel" role="tabpanel" key={tab} className="page-reveal">
        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 border border-border/40 bg-surface/60 font-mono text-xs text-muted-foreground">
            <span className="live-dot" />
            <span>Loading {tab.toLowerCase()} bookings...</span>
          </div>
        ) : bookings.length === 0 ? (
          <div className="grid min-h-72 place-items-center border border-dashed border-border bg-surface text-center">
            <div>
              <CarFront className="mx-auto size-9 text-muted-foreground" />
              <h2 className="mt-4 font-display text-2xl">No {tab.toLowerCase()} bookings</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your parking activity will appear here.
              </p>
              <Link to="/parking" className="mt-5 inline-block">
                <Button>Book parking</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <article
                key={b.id}
                className="interactive-lift grid gap-6 border border-border bg-surface p-6 lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <StatusBadge status={b.status} />
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                        b.payment_status === "paid" &&
                          "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                        b.payment_status === "refunded" &&
                          "border border-blue-500/30 bg-blue-500/10 text-blue-500",
                        b.payment_status === "partially_refunded" &&
                          "border border-amber-500/30 bg-amber-500/10 text-amber-500",
                        b.payment_status === "failed" &&
                          "border border-rose-500/30 bg-rose-500/10 text-rose-500",
                        b.payment_status === "pending" &&
                          "border border-border bg-muted/20 text-muted-foreground",
                      )}
                    >
                      Payment: {b.payment_status.replace("_", " ")}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{b.reference}</span>
                  </div>
                  <div className="mt-5 flex items-end gap-4">
                    <strong className="font-display text-4xl sm:text-5xl">
                      {b.parking_slots?.code || "Bay"}
                    </strong>
                    <span className="mb-1 text-sm text-muted-foreground">
                      Level {b.parking_slots?.level_code || "—"} ·{" "}
                      {b.plate_snapshot || b.vehicles?.plate_number || "—"}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                    <span>{formatIstDateTime(b.start_at)}</span>
                    <span className="font-mono font-medium">
                      {b.plate_snapshot || b.vehicles?.plate_number || "—"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatPaise(b.total_paise)}
                    </span>
                    {b.status === "cancelled" && b.refund_paise > 0 && (
                      <span className="font-medium text-emerald-500">
                        Refund: {formatPaise(b.refund_paise)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/confirmation"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        sessionStorage.setItem("parkgrid_last_booking_id", b.id);
                        sessionStorage.setItem("parkgrid_last_booking", JSON.stringify(b));
                      }
                    }}
                  >
                    <Button>QR Pass</Button>
                  </Link>
                  {(b.status === "confirmed" || b.status === "reserved") && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCancelTarget(b)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ── Cancellation Modal with Live Refund Preview ── */}
      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking {cancelTarget?.reference}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs text-muted-foreground text-left">
                <p>
                  You are about to cancel your reservation for Bay{" "}
                  <strong className="text-foreground">
                    {cancelTarget?.parking_slots?.code || "Bay"}
                  </strong>{" "}
                  on{" "}
                  <strong className="text-foreground">
                    {cancelTarget ? formatIstDateTime(cancelTarget.start_at) : ""}
                  </strong>
                  .
                </p>
                {previewLoading ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    Calculating refund preview...
                  </p>
                ) : cancelPreview ? (
                  <div className="rounded-lg border border-border bg-background p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span>Total Paid:</span>
                      <strong className="text-foreground font-mono">
                        {formatPaise(cancelPreview.total_paise)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Refund Tier:</span>
                      <strong className="text-foreground">
                        {cancelPreview.refund_percentage}% refund
                      </strong>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-1.5">
                      <span className="font-medium text-foreground">Refund to be returned:</span>
                      <strong className="text-emerald-500 font-mono text-sm">
                        {formatPaise(cancelPreview.refund_paise)}
                      </strong>
                    </div>
                  </div>
                ) : null}
                <p className="text-[11px] leading-relaxed">
                  ParkGrid refund policy: 100% refund if cancelled 2+ hours prior, 50% refund if
                  30m–2h prior, non-refundable within 30 minutes of arrival.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}

function ActiveParking() {
  const [seconds, setSeconds] = useState(6135);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0"),
    m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0"),
    s = String(seconds % 60).padStart(2, "0");
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="border border-selected/30 bg-selected/5 p-8">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-selected">
          <span className="live-dot" /> Active parking
        </p>
        <p className="mt-6 font-display text-6xl sm:text-8xl">
          {h}:{m}:{s}
        </p>
        <p className="mt-2 text-muted-foreground">Time remaining · Slot A12</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <InfoRow label="Entry" value="10:02 AM" />
          <InfoRow label="Vehicle" value="MH12AB1234" />
          <InfoRow label="Location" value="Floor 1 · Zone A" />
        </div>
        <div className="mt-8 flex gap-2">
          <Button>Extend parking</Button>
          <Button variant="destructive">End parking</Button>
        </div>
      </div>
      <div className="grid place-items-center border border-border bg-surface p-6">
        <QRCodeSVG value="ACTIVE-SP-10231" size={180} />
        <p className="mt-4 text-xs text-muted-foreground">Exit QR pass</p>
      </div>
    </div>
  );
}

export function EVPage() {
  const chargers = [
    { id: "01", power: "60 kW", status: "available" },
    { id: "02", power: "30 kW", status: "occupied" },
    { id: "03", power: "60 kW", status: "reserved" },
    { id: "04", power: "22 kW", status: "maintenance" },
  ];
  return (
    <PageFrame eyebrow="Charge while you park" title="EV charging">
      <div className="mb-8 grid gap-6 border border-ev/30 bg-ev/5 p-7 lg:grid-cols-2">
        <div>
          <BatteryCharging className="size-10 text-ev" />
          <h2 className="mt-5 font-display text-3xl">Fast, monitored charging</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Track live energy, time, and cost from your parking session. CCS and Type 2 connectors
            available.
          </p>
        </div>
        <div className="battery-meter self-center">
          <span style={{ width: "68%" }} />
          <strong>68%</strong>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {chargers.map((c) => (
          <article key={c.id} className="border border-border bg-surface p-5">
            <div className="flex justify-between">
              <Zap className="size-6 text-ev" />
              <StatusBadge
                status={c.status as "available" | "occupied" | "reserved" | "maintenance"}
              />
            </div>
            <p className="mt-8 font-mono text-xs text-muted-foreground">EV CHARGER</p>
            <h2 className="font-display text-3xl">{c.id}</h2>
            <div className="mt-5 flex justify-between text-sm">
              <span>CCS</span>
              <strong>{c.power}</strong>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">₹12/kWh</p>
            <Link to="/parking">
              <Button className="mt-6 w-full" disabled={c.status !== "available"}>
                Book charger
              </Button>
            </Link>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

export function InformationPage() {
  const items = [
    "Parking rules",
    "Pricing",
    "Cancellation & refunds",
    "Operating hours",
    "Entry instructions",
    "Exit instructions",
    "EV charging",
    "Safety",
    "Frequently asked questions",
  ];
  return (
    <PageFrame
      eyebrow="Plan your visit"
      title="Parking information"
      copy="Clear answers for a smooth visit to ParkGrid One."
    >
      <div className="max-w-4xl divide-y divide-border border-y border-border">
        {items.map((item, i) => (
          <details key={item} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-display text-xl">
              <span>{item}</span>
              <ChevronDown className="size-5 transition group-open:rotate-180" />
            </summary>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              {i === 0
                ? "Drive at or below 8 km/h, follow lane arrows, and park only in your reserved bay. Keep your QR pass ready for entry and exit."
                : i === 1
                  ? "Standard parking starts at ₹50 per hour. EV bays start at ₹70 per hour, with charging billed separately at ₹12 per kWh."
                  : "Your booking details and facility guidance will appear here. Ask Parking AI for a quick, facility-specific answer."}
            </p>
          </details>
        ))}
      </div>
    </PageFrame>
  );
}

export function LocationPage() {
  return (
    <PageFrame
      eyebrow="Find ParkGrid One"
      title="Bandra Kurla Complex, Mumbai"
      copy="Inside Bandra Kurla Complex, with separate entry and exit lanes."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="location-map relative min-h-[480px] overflow-hidden border border-border bg-surface">
          <div className="absolute left-[18%] top-[18%] border border-primary/40 bg-background p-3 shadow-xl">
            <span className="font-mono text-[10px] uppercase text-primary">Entrance</span>
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-selected bg-selected/10 p-8 text-center">
            <CarFront className="mx-auto size-8 text-selected" />
            <strong className="mt-2 block font-display text-2xl">ParkGrid One</strong>
          </div>
          <div className="absolute bottom-[15%] right-[18%] border border-available/40 bg-background p-3 shadow-xl">
            <span className="font-mono text-[10px] uppercase text-available">Exit</span>
          </div>
        </div>
        <div className="space-y-4">
          <InfoPanel icon={MapPin} title="Address" copy={facility.address} />
          <InfoPanel
            icon={Navigation}
            title="Nearby landmark"
            copy="Located inside BKC, near G-Block, Bandra East."
          />
          <InfoPanel icon={Clock3} title="Operating hours" copy="Open 24 hours, every day." />
          <InfoPanel
            icon={Headphones}
            title="Contact"
            copy="+91 20 4827 2400 · help@parkgrid.one"
          />
          <Button size="lg" className="w-full">
            Get directions <ExternalLink />
          </Button>
        </div>
      </div>
    </PageFrame>
  );
}
export function AssistantPage() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (status === "ready") inputRef.current?.focus();
  }, [status]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    sendMessage({ text });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const suggestions = [
    "What are the parking rules?",
    "How much does parking cost?",
    "Is EV charging available?",
    "Where is the entrance?",
  ];

  const quickActions: [React.ElementType, string, string, string][] = [
    [SquareParking, "🅿", "Find a parking slot", "Check real-time bay availability"],
    [IndianRupee, "₹", "Check parking price", "From ₹50/hr · EV from ₹70/hr"],
    [Zap, "⚡", "EV charging", "6 fast chargers · CCS & Type 2"],
    [ScrollText, "📋", "Parking rules", "Speed limit, bay rules & more"],
  ];

  return (
    <PageFrame
      eyebrow="Facility intelligence"
      title="Ask Parking AI"
      copy="Instant answers grounded in ParkGrid One's rules, pricing, access, and live parking context."
    >
      <div className="grid min-h-[620px] overflow-hidden border border-border lg:grid-cols-[300px_1fr]">
        {/* ── Sidebar: Premium Concierge Panel ── */}
        <aside className="ai-sidebar border-b border-border p-5 lg:border-b-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="grid size-12 place-items-center border border-primary/30 bg-primary/10 text-primary">
              <Bot />
            </div>
            <span className="ai-status-chip">
              <span className="ai-status-dot" aria-hidden="true" />
              AI ONLINE
            </span>
          </div>

          <h2 className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Parking Concierge
          </h2>
          <p className="mt-1 font-display text-xl font-semibold leading-snug">ParkGrid One</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            One private session. Messages disappear when you leave.
          </p>

          {/* Quick Questions */}
          <div className="mt-6">
            <p className="ai-section-label">Quick Questions</p>
            <div className="grid gap-2">
              {suggestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal py-2.5 text-left text-xs transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => ask(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="mt-6">
            <p className="ai-section-label">System Status</p>
            <div className="grid gap-1.5">
              <div className="ai-sys-row">
                <Activity className="ai-sys-icon size-3.5" aria-hidden="true" />
                <span>Live parking data</span>
                <span className="ml-auto font-mono text-[10px] text-available">LIVE</span>
              </div>
              <div className="ai-sys-row">
                <Database className="ai-sys-icon size-3.5" aria-hidden="true" />
                <span>Facility knowledge</span>
                <span className="ml-auto font-mono text-[10px] text-available">READY</span>
              </div>
              <div className="ai-sys-row">
                <BookOpen className="ai-sys-icon size-3.5" aria-hidden="true" />
                <span>Booking context</span>
                <span className="ml-auto font-mono text-[10px] text-available">ACTIVE</span>
              </div>
              <div className="ai-sys-row">
                <Wifi className="ai-sys-icon size-3.5" aria-hidden="true" />
                <span>BKC · Mumbai</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">ONLINE</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Chat area ── */}
        <div className="flex min-h-[620px] flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl px-5 py-7">
              {messages.length === 0 ? (
                /* ── Empty state: premium command-center ── */
                <>
                  <div
                    className="ai-chat-bg absolute inset-0 -z-10 pointer-events-none"
                    aria-hidden="true"
                  />
                  <div className="flex min-h-80 flex-col items-center justify-center gap-8 text-center relative">
                    {/* AI icon with glow + radar */}
                    <div className="relative">
                      <span className="ai-icon-glow" aria-hidden="true" />
                      <div className="ai-icon-wrap" aria-hidden="true">
                        <Bot className="size-7 text-primary" />
                      </div>
                    </div>

                    {/* Heading */}
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                        Parking AI
                      </p>
                      <h2 className="font-display text-3xl font-semibold">
                        How can I help with your visit?
                      </h2>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        BKC · Mumbai
                      </p>
                      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                        Ask about spaces, entry, pricing, EV charging, or your booking.
                      </p>
                    </div>

                    {/* Quick-action cards */}
                    <div className="grid w-full max-w-xl grid-cols-2 gap-3">
                      {quickActions.map(([_Icon, emoji, label, sub]) => (
                        <button
                          key={label}
                          className="ai-quick-card"
                          onClick={() => ask(label)}
                          type="button"
                          aria-label={`Ask: ${label}`}
                        >
                          <span className="text-xl" aria-hidden="true">
                            {emoji}
                          </span>
                          <strong className="block text-sm font-semibold leading-tight">
                            {label}
                          </strong>
                          <span className="text-[11px] text-muted-foreground">{sub}</span>
                          <ArrowRight className="ai-card-arrow size-3.5" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                messages.map((message) => (
                  <Message className="message-enter" from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, index) =>
                        part.type === "text" ? (
                          <MessageResponse key={index}>{part.text}</MessageResponse>
                        ) : null,
                      )}
                    </MessageContent>
                  </Message>
                ))
              )}
              {status === "submitted" && (
                <Shimmer className="text-sm">Checking ParkGrid One...</Shimmer>
              )}
              {error && <p className="text-sm text-destructive">{error.message}</p>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* ── Polished input area ── */}
          <div className="ai-input-shell">
            <PromptInput onSubmit={({ text }) => ask(text)} className="mx-auto max-w-3xl">
              <PromptInputTextarea
                ref={inputRef}
                placeholder="Ask about parking, pricing, EV charging..."
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit
                  status={status}
                  onStop={stop}
                  disabled={status !== "ready" && status !== "error"}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { data: userVehicles } = useVehicles();
  const preferredVehicle =
    userVehicles?.find((v) => v.is_default)?.plate_number ??
    userVehicles?.[0]?.plate_number ??
    "None registered";

  const [activeTab, setActiveTab] = useState<"Profile" | "Payment methods">("Profile");

  const navMap: Record<string, "/vehicles" | "/bookings" | "/notifications"> = {
    Vehicles: "/vehicles",
    Bookings: "/bookings",
    Notifications: "/notifications",
  };
  return (
    <PageFrame eyebrow="Your account" title="Profile & settings">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="border border-border bg-surface p-3">
          {[
            "Profile",
            "Vehicles",
            "Bookings",
            "Payment methods",
            "Notifications",
            "Security",
            "Logout",
          ].map((x) => {
            const isSelected =
              (x === "Profile" && activeTab === "Profile") ||
              (x === "Payment methods" && activeTab === "Payment methods");
            return (
              <Button
                key={x}
                variant={isSelected ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  if (x === "Logout") {
                    sessionStorage.removeItem("parkgrid_authenticated");
                    sessionStorage.removeItem("parkgrid_seen_intro");
                    window.dispatchEvent(new CustomEvent("parkgrid-logout"));
                    toast.info("Logged out of ParkGrid");
                  } else if (x === "Payment methods") {
                    setActiveTab("Payment methods");
                  } else if (x === "Profile") {
                    setActiveTab("Profile");
                  } else {
                    const target = navMap[x];
                    if (target) {
                      navigate({ to: target });
                    }
                  }
                }}
              >
                {x}
              </Button>
            );
          })}
        </aside>

        {activeTab === "Payment methods" ? (
          <div className="border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl">Payment methods</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage saved cards and UPI IDs for express parking checkout.
                </p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-amber-500 border border-amber-500/30">
                Demo only, nothing is stored
              </span>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-muted-foreground">
              <ShieldCheck className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <strong className="block text-foreground font-medium">
                  Sandbox Simulation Environment
                </strong>
                <p className="mt-0.5 leading-relaxed">
                  Demo only, nothing is stored. Real card numbers, CVV codes, bank PINs, or
                  sensitive credentials are never collected, stored, or transmitted to our servers.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded bg-primary/10 text-primary">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <strong className="block text-sm text-foreground">
                      HDFC Bank Regalia •••• 4242
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      Expires 08/29 · Visa Credit
                    </span>
                  </div>
                </div>
                <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Default
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded bg-muted/30 text-muted-foreground">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <strong className="block text-sm text-foreground">bhushan@oksbi</strong>
                    <span className="text-xs text-muted-foreground">UPI Autopay · Verified</span>
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground">Active</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded bg-muted/30 text-muted-foreground">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <strong className="block text-sm text-foreground">
                      ICICI Coral RuPay •••• 8821
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      Expires 11/30 · RuPay Platinum
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground">Active</span>
              </div>
            </div>

            <Button
              className="mt-6"
              variant="outline"
              onClick={() =>
                toast.info("Demo only: Payment method management is simulated in sandbox mode.")
              }
            >
              + Add payment method
            </Button>
          </div>
        ) : (
          <div className="border border-border bg-surface p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-full bg-primary/10 font-display text-xl text-primary">
                BD
              </span>
              <div>
                <h2 className="font-display text-2xl">Bhushan Dhavale</h2>
                <p className="text-sm text-muted-foreground">Member since September 2026</p>
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                Full name
                <input className="field-input" defaultValue="Bhushan Dhavale" />
              </label>
              <label className="field-label">
                Email
                <input className="field-input" defaultValue="bhushan@example.com" />
              </label>
              <label className="field-label">
                Phone
                <input className="field-input" defaultValue="+91 98765 43210" />
              </label>
              <label className="field-label">
                Preferred vehicle
                <input className="field-input font-mono" value={preferredVehicle} readOnly />
              </label>
            </div>
            <Button className="mt-6">Save changes</Button>
            <div className="mt-10 border-t border-border pt-8">
              <div className="mb-4">
                <h3 className="font-display text-xl font-semibold">Theme & Appearance</h3>
                <p className="text-xs text-muted-foreground">
                  Select your visual theme. Changes apply instantly and persist across sessions.
                </p>
              </div>
              <ThemeSelector variant="grid" />
            </div>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

export function AuthPage() {
  const [signup, setSignup] = useState(false);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={heroImage} alt="ParkGrid One entrance" className="size-full object-cover" />
        <div className="hero-scrim absolute inset-0" />
        <div className="absolute bottom-12 left-12 max-w-lg text-hero-foreground">
          <CarFront className="size-9 text-primary" />
          <h1 className="mt-5 font-display text-5xl">Arrive with certainty.</h1>
          <p className="mt-3 text-hero-muted">
            Book, enter, and park at ParkGrid One in a few calm steps.
          </p>
        </div>
      </div>
      <div className="grid place-items-center bg-background px-6 py-20">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">ParkGrid One</p>
          <h1 className="mt-4 font-display text-4xl">
            {signup ? "Create your account" : "Welcome back"}
          </h1>
          <div className="mt-8 space-y-4">
            {signup && (
              <label className="field-label">
                Name
                <input className="field-input" placeholder="Your name" />
              </label>
            )}
            <label className="field-label">
              Email
              <input type="email" className="field-input" placeholder="you@example.com" />
            </label>
            <label className="field-label">
              Password
              <input type="password" className="field-input" placeholder="••••••••" />
            </label>
            {signup && (
              <label className="field-label">
                Confirm password
                <input type="password" className="field-input" placeholder="••••••••" />
              </label>
            )}
            <Button size="lg" className="w-full">
              {signup ? "Create account" : "Log in"}
            </Button>
          </div>
          <button
            className="mt-6 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setSignup(!signup)}
          >
            {signup ? "Already have an account? Log in" : "Don’t have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const stats = [
    ["Total slots", "150", CarFront],
    ["Available", "73", Check],
    ["Occupied", "62", Activity],
    ["Reserved", "15", Clock3],
    ["Today’s bookings", "86", CalendarDays],
    ["Revenue", "₹24.8K", IndianRupee],
    ["Active sessions", "41", CircleGauge],
  ] as const;
  return (
    <PageFrame
      eyebrow="Operations centre"
      title="Facility overview"
      copy="Live operational visibility for ParkGrid One."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, StatIcon]) => (
          <div key={label} className="border border-border bg-surface p-5">
            <StatIcon className="size-5 text-primary" />
            <strong className="mt-5 block font-display text-3xl">{value}</strong>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          <h2 className="mb-4 font-display text-2xl">Live parking map</h2>
          <ParkingMap />
        </div>
        <div>
          <h2 className="mb-4 font-display text-2xl">Recent bookings</h2>
          <div className="divide-y divide-border border border-border bg-surface">
            {["SP-10231 · A12", "SP-10230 · E04", "SP-10229 · B16", "SP-10228 · A08"].map(
              (b, i) => (
                <div key={b} className="flex items-center justify-between p-4">
                  <div>
                    <strong className="text-sm">{b}</strong>
                    <p className="text-xs text-muted-foreground">
                      {i + 9}:0{i} AM · ₹{118 + i * 20}
                    </p>
                  </div>
                  <StatusBadge status={i === 0 ? "active" : "reserved"} />
                </div>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Slot management</h2>
          <Button>
            <Plus /> Add parking slot
          </Button>
        </div>
        <DataTable />
      </div>
    </PageFrame>
  );
}

function DataTable() {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-muted font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            {["Slot", "Floor", "Zone", "Type", "EV", "Status", "Price", "Actions"].map((h) => (
              <th key={h} className="p-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {parkingSlots.slice(0, 6).map((s) => (
            <tr key={s.id} className="bg-surface hover:bg-accent/50">
              <td className="p-4 font-mono font-bold">{s.id}</td>
              <td className="p-4">{s.floor}</td>
              <td className="p-4">{s.zone}</td>
              <td className="p-4">{s.type}</td>
              <td className="p-4">{s.zone === "EV" ? "Yes" : "No"}</td>
              <td className="p-4">
                <StatusBadge status={s.status} />
              </td>
              <td className="p-4">₹{s.price}</td>
              <td className="p-4">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${s.id}`}>
                    <Edit3 />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${s.id}`}>
                    <Trash2 />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KnowledgePage() {
  const [selectedCat, setSelectedCat] = useState<FAQCategory | "All">("All");
  const filteredChunks =
    selectedCat === "All" ? FAQ_DATABASE : FAQ_DATABASE.filter((f) => f.category === selectedCat);

  return (
    <PageFrame
      eyebrow="Admin · AI Knowledge Hub"
      title="RAG Knowledge Base & Documents"
      copy="Official facility documents and structured chunks utilized by the ParkGrid AI Concierge for retrieval-augmented generation."
    >
      {/* ── Key Metrics ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Indexed Documents", String(RAG_DOCUMENTS.length), "6 official manuals"],
          ["Knowledge Chunks", String(FAQ_DATABASE.length), "Fine-grained Q&A blocks"],
          ["Vector Dimension", "1,536", "OpenAI embedding model"],
          ["Index Status", "OPERATIONAL", "v2.4.1 synced"],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-border bg-surface p-5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <strong className="mt-1 block font-display text-3xl text-foreground">{value}</strong>
            <span className="mt-1 block text-xs text-primary">{sub}</span>
          </div>
        ))}
      </div>

      {/* ── RAG Taxonomy Overview (Tree) ── */}
      <div className="mt-8 border border-border bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              RAG Hierarchy
            </span>
            <h3 className="font-display text-xl font-semibold">Structured Knowledge Taxonomy</h3>
          </div>
          <Link to="/faq">
            <Button size="sm" variant="outline">
              View Public Help Center <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
          <div className="border border-border/80 bg-background p-3.5">
            <strong className="text-primary block mb-2">🅿 Parking</strong>
            <ul className="space-y-1 text-muted-foreground text-[11px]">
              <li>├── Rules &amp; Speed Limit</li>
              <li>├── Floors (B1–L2)</li>
              <li>├── Slot Types &amp; Colors</li>
              <li>├── Heavy Vehicle Policy</li>
              <li>└── Operating Hours (24/7)</li>
            </ul>
          </div>

          <div className="border border-border/80 bg-background p-3.5">
            <strong className="text-cyan-400 block mb-2">🎫 Booking</strong>
            <ul className="space-y-1 text-muted-foreground text-[11px]">
              <li>├── Booking Process</li>
              <li>├── Slot Selection</li>
              <li>├── Modification (≤ 30m)</li>
              <li>├── Extension Flow</li>
              <li>└── Digital QR Passes</li>
            </ul>
          </div>

          <div className="border border-border/80 bg-background p-3.5">
            <strong className="text-amber-400 block mb-2">💳 Payment</strong>
            <ul className="space-y-1 text-muted-foreground text-[11px]">
              <li>├── Pricing &amp; GST (18%)</li>
              <li>├── UPI &amp; Cards Gateway</li>
              <li>├── Failed Transactions</li>
              <li>└── Refund Bank SLAs</li>
            </ul>
          </div>

          <div className="border border-border/80 bg-background p-3.5">
            <strong className="text-emerald-400 block mb-2">⚡ EV Charging</strong>
            <ul className="space-y-1 text-muted-foreground text-[11px]">
              <li>├── 60 kW CCS2 &amp; Type-2</li>
              <li>├── Live Bay Availability</li>
              <li>├── Tariffs (₹12/kWh)</li>
              <li>└── Plug &amp; Session Setup</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Document Registry ── */}
      <div className="mt-8">
        <h3 className="mb-4 font-display text-2xl font-semibold">Source Documents Registry</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {RAG_DOCUMENTS.map((doc) => (
            <div
              key={doc.name}
              className="flex flex-col justify-between border border-border bg-surface p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <strong className="text-sm font-semibold">{doc.name}</strong>
                  </div>
                  <StatusBadge status="available" />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{doc.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] font-mono text-muted-foreground">
                <span>
                  Category: <strong className="text-foreground">{doc.category}</strong>
                </span>
                <span>
                  Chunks: <strong className="text-primary">{doc.chunksCount}</strong>
                </span>
                <span>Size: {doc.fileSize}</span>
                <span>v{doc.version}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chunks Inspector ── */}
      <div className="mt-10 border border-border bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-semibold">Indexed RAG Chunks</h3>
            <p className="text-xs text-muted-foreground">
              Every chunk maintains strict metadata for semantic search and retrieval grounding.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCat("All")}
              className={cn(
                "px-2.5 py-1 text-xs border transition",
                selectedCat === "All"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-background text-muted-foreground",
              )}
            >
              All ({FAQ_DATABASE.length})
            </button>
            {FAQ_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCat(c.id)}
                className={cn(
                  "px-2.5 py-1 text-xs border transition",
                  selectedCat === c.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-background text-muted-foreground",
                )}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredChunks.map((chunk) => (
            <div key={chunk.id} className="border border-border/80 bg-background p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-primary font-bold">{chunk.id}</span>
                  <span className="font-mono uppercase text-muted-foreground">
                    [{chunk.category} &gt; {chunk.subcategory}]
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Source: {chunk.document}
                </span>
              </div>

              <h4 className="mt-2 font-display text-sm font-semibold text-foreground">
                Q: {chunk.question}
              </h4>
              <p className="mt-1 text-muted-foreground leading-relaxed">{chunk.answer}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/40 pt-2 font-mono text-[10px] text-muted-foreground">
                <span>Version: v{chunk.version}</span>
                <span>Updated: {chunk.lastUpdated}</span>
                {chunk.badge && (
                  <span className="text-primary font-bold">Badge: {chunk.badge}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}

export function NotificationsPage() {
  const rows = [
    ["Booking confirmed", "Your slot A12 is reserved.", "Just now", Check],
    ["Parking starting soon", "Your booking starts in 30 minutes.", "12 min", Clock3],
    ["Payment successful", "₹118 paid for SP-20260920-10231.", "14 min", WalletCards],
    ["EV charging completed", "Charger 01 reached your target.", "Yesterday", BatteryCharging],
  ] as const;
  return (
    <PageFrame eyebrow="Updates" title="Notifications">
      <div className="max-w-4xl divide-y divide-border border border-border bg-surface">
        {rows.map(([title, copy, time, NoticeIcon]) => (
          <div key={title} className="flex gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <NoticeIcon />
            </span>
            <div className="flex-1">
              <strong className="text-sm">{title}</strong>
              <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
            </div>
            <time className="text-[11px] text-muted-foreground">{time}</time>
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

function PageFrame({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="page-reveal min-h-screen pt-28 pb-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="mb-10">
          <SectionHeading eyebrow={eyebrow} title={title} {...(copy ? { copy } : {})} />
        </div>
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}
function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right",
          strong && "font-display text-2xl font-semibold text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
function InfoPanel({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof MapPin;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-4 border border-border bg-surface p-5">
      <Icon className="size-5 shrink-0 text-primary" />
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}
