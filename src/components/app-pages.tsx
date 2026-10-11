import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  ArrowRight,
  BatteryCharging,
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
  ScanLine,
  ScrollText,
  ShieldCheck,
  SquareParking,
  Sparkles,
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
  const [selected, setSelected] = useState<ParkingSlotData>(initialSlot);
  const [duration, setDuration] = useState(2);
  const [date, setDate] = useState("2026-09-20");
  const [arrival, setArrival] = useState("10:00");
  const [priceKey, setPriceKey] = useState(0);
  const base = selected.price * duration;
  const total = base * 1.18;
  const valid = Boolean(date && arrival && duration > 0);
  const updateSlot = (slot: ParkingSlotData) => {
    setSelected(slot);
    setPriceKey((key) => key + 1);
    toast.success(`${slot.id} selected`);
  };
  const updateDuration = (value: number) => {
    setDuration(value);
    setPriceKey((key) => key + 1);
  };
  return (
    <PageFrame
      eyebrow="Book a space"
      title="Choose your bay"
      copy="Live availability across all three floors."
    >
      <div className="mb-5 grid gap-3 border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="field-label">
          Date
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Arrival
          <input
            required
            type="time"
            value={arrival}
            onChange={(event) => setArrival(event.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Duration
          <select
            required
            value={duration}
            onChange={(event) => updateDuration(Number(event.target.value))}
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
        <ParkingMap onSelection={updateSlot} />
        <aside className="space-y-4">
          <div key={selected.id} className="selection-pulse border border-border bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Selected bay
            </p>
            <div className="mt-3 flex items-center justify-between">
              <strong className="font-display text-4xl">{selected.id}</strong>
              <StatusBadge status="available" />
            </div>
            <dl className="mt-5 grid gap-3 text-sm">
              <InfoRow label="Floor" value={`Level ${selected.floor}`} />
              <InfoRow
                label="Zone"
                value={selected.zone === "EV" ? "EV charging" : `Zone ${selected.zone}`}
              />
              <InfoRow label="Vehicle" value={selected.type} />
              <InfoRow label="Rate" value={`₹${selected.price}/hour`} />
            </dl>
          </div>
          <div className="sticky top-24 border border-primary/30 bg-primary/5 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Booking summary
            </p>
            <div key={priceKey} className="price-pop mt-5 space-y-3 text-sm" aria-live="polite">
              <InfoRow label="Parking" value={`₹${base}`} />
              <InfoRow label="Tax" value={`₹${(base * 0.18).toFixed(0)}`} />
              <div className="border-t border-border pt-4">
                <InfoRow label="Total" value={`₹${total.toFixed(0)}`} strong />
              </div>
            </div>
            {valid ? (
              <Link to="/vehicles" className="mt-5 block">
                <Button size="lg" className="w-full">
                  Continue <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            ) : (
              <Button size="lg" className="mt-5 w-full" disabled>
                Complete booking details
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

export function VehiclesPage() {
  type Vehicle = { name: string; plate: string; fuel: string };
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { name: "BMW 3 Series", plate: "MH12AB1234", fuel: "Petrol" },
    { name: "Ather 450X", plate: "MH14EV8210", fuel: "Electric" },
  ]);
  const [selected, setSelected] = useState("MH12AB1234");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const openForm = (vehicle?: Vehicle) => {
    setEditing(vehicle ?? { name: "", plate: "", fuel: "Petrol" });
    setDialogOpen(true);
  };
  const saveVehicle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setVehicles((current) => {
      const exists = current.some((item) => item.plate === editing.plate);
      return exists
        ? current.map((item) => (item.plate === editing.plate ? editing : item))
        : [...current, editing];
    });
    setSelected(editing.plate);
    setDialogOpen(false);
    toast.success("Vehicle saved locally", {
      description: "Prototype data resets when you leave this page.",
    });
  };
  const removeVehicle = () => {
    if (!deleteTarget) return;
    const removed = deleteTarget;
    setVehicles((current) => current.filter((item) => item.plate !== removed.plate));
    setDeleteTarget(null);
    toast("Vehicle removed", {
      action: { label: "Undo", onClick: () => setVehicles((current) => [...current, removed]) },
    });
  };
  return (
    <PageFrame
      eyebrow="Your garage"
      title="Choose a vehicle"
      copy="We'll match your vehicle to the right bay dimensions and services."
    >
      <div
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        role="radiogroup"
        aria-label="Saved vehicles"
      >
        {vehicles.map((vehicle) => (
          <article
            key={vehicle.plate}
            className={cn(
              "interactive-lift border bg-surface p-6",
              selected === vehicle.plate
                ? "border-selected shadow-[0_0_24px_var(--selected-glow)]"
                : "border-border",
            )}
          >
            <CarFront className="size-10 text-primary" />
            <h2 className="mt-8 font-display text-2xl">{vehicle.name}</h2>
            <p className="mt-1 font-mono text-sm">{vehicle.plate}</p>
            <p className="mt-1 text-xs text-muted-foreground">{vehicle.fuel}</p>
            <div className="mt-6 flex gap-2">
              <Button
                role="radio"
                aria-checked={selected === vehicle.plate}
                onClick={() => setSelected(vehicle.plate)}
                variant={selected === vehicle.plate ? "default" : "outline"}
              >
                {selected === vehicle.plate ? "Selected" : "Select"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Edit ${vehicle.name}`}
                onClick={() => openForm(vehicle)}
              >
                <Edit3 />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${vehicle.name}`}
                onClick={() => setDeleteTarget(vehicle)}
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
        {/* Add vehicle — simple dashed empty state */}
        <button
          type="button"
          className="add-vehicle-empty"
          onClick={() => openForm()}
          aria-label="Add a new vehicle"
        >
          <Plus className="size-10" strokeWidth={1.5} />
          <span className="text-sm font-medium">Add vehicle</span>
        </button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Vehicle changes are saved only for this demo session.
      </p>
      <div className="mt-8 flex justify-end">
        <Link to="/checkout">
          <Button size="lg" disabled={!selected}>
            Continue to checkout{" "}
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={saveVehicle}>
            <DialogHeader>
              <DialogTitle>
                {vehicles.some((item) => item.plate === editing?.plate)
                  ? "Edit vehicle"
                  : "Add vehicle"}
              </DialogTitle>
              <DialogDescription>
                This prototype stores changes only until you leave the page.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 grid gap-4">
              <label className="field-label">
                Vehicle name
                <input
                  required
                  className="field-input"
                  value={editing?.name ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="field-label">
                Registration plate
                <input
                  required
                  className="field-input"
                  value={editing?.plate ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, plate: event.target.value.toUpperCase() } : current,
                    )
                  }
                />
              </label>
              <label className="field-label">
                Fuel type
                <select
                  className="field-input"
                  value={editing?.fuel ?? "Petrol"}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, fuel: event.target.value } : current,
                    )
                  }
                >
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>Electric</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save vehicle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the vehicle from this demo session. You can undo the action from the
              notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep vehicle</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeVehicle}
              className="bg-destructive text-destructive-foreground"
            >
              Delete vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const pay = () => {
    if (processing) return;
    setProcessing(true);
    window.setTimeout(() => {
      toast.success("Payment approved");
      navigate({ to: "/confirmation" });
    }, 900);
  };
  return (
    <PageFrame eyebrow="Secure checkout" title="Review and pay">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="border border-border bg-surface p-6">
          <h2 className="font-display text-2xl">Parking details</h2>
          <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2">
            {[
              ["Facility", facility.name],
              ["Slot", "A12 · Floor 1"],
              ["Date", "20 September 2026"],
              ["Time", "10:00 AM"],
              ["Duration", "2 hours"],
              ["Vehicle", "MH12AB1234"],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface p-4">
                <span className="text-xs text-muted-foreground">{label}</span>
                <strong className="mt-1 block text-sm">{value}</strong>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 border border-available/30 bg-available/5 p-4">
            <ShieldCheck className="size-6 text-available" />
            <p className="text-sm">
              <strong className="block">Your space is held</strong>
              <span className="text-muted-foreground">
                Complete payment to confirm this reservation.
              </span>
            </p>
          </div>
        </div>
        <div className="border border-primary/30 bg-primary/5 p-6">
          <h2 className="font-display text-2xl">Price summary</h2>
          <div className="mt-6 space-y-4">
            <InfoRow label="Parking" value="₹100" />
            <InfoRow label="Tax (18%)" value="₹18" />
            <div className="border-t border-border pt-5">
              <InfoRow label="Total" value="₹118" strong />
            </div>
          </div>
          <Button size="lg" className="mt-7 w-full" loading={processing} onClick={pay}>
            <LockKeyhole /> {processing ? "Processing securely" : "Secure payment"}
          </Button>
          <p className="mt-4 text-center text-[10px] text-muted-foreground" aria-live="polite">
            {processing ? "Verifying your demo payment…" : "Encrypted checkout · UPI · Cards"}
          </p>
        </div>
      </div>
    </PageFrame>
  );
}

export function ConfirmationPage() {
  const bookingId = "SP-20260920-10231";
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
      await navigator.clipboard.writeText(bookingId);
      setCopied(true);
      toast.success("Booking ID copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy was blocked", { description: `Booking ID: ${bookingId}` });
    }
  };
  const download = () => {
    setDownloading(true);
    saveFile(
      `${bookingId}.txt`,
      `PARKGRID ONE PARKING PASS\nBooking: ${bookingId}\nSlot: A12\nDate: 20 September 2026\nTime: 10:00 AM\nDuration: 2 hours\nVehicle: MH12AB1234`,
      `text/plain`,
    );
    window.setTimeout(() => setDownloading(false), 700);
    toast.success("Parking pass downloaded");
  };
  const calendar = () => {
    saveFile(
      `${bookingId}.ics`,
      [
        `BEGIN:VCALENDAR`,
        `VERSION:2.0`,
        `PRODID:-//ParkGrid One//Booking//EN`,
        `BEGIN:VEVENT`,
        `UID:${bookingId}@parkgrid.one`,
        `DTSTAMP:20260919T120000Z`,
        `DTSTART:20260920T043000Z`,
        `DTEND:20260920T063000Z`,
        `SUMMARY:Parking at ParkGrid One - Slot A12`,
        `LOCATION:${facility.address}`,
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
            Booking ID · {bookingId}
          </p>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy booking ID"
            onClick={copyId}
            success={copied}
          >
            {!copied && <Copy />}
          </Button>
        </div>
        <h2 className="mt-2 font-display text-5xl">A12</h2>
        <p className="mt-2 text-muted-foreground">20 September · 10:00 AM · 2 hours</p>
        <div className="qr-shell relative mx-auto mt-8 w-fit bg-qr p-5 text-qr-foreground">
          <QRCodeSVG value={`${bookingId}-A12`} size={184} />
          <span className="qr-scan-line" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Scan at the entry gate</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link to="/bookings">
            <Button>View booking</Button>
          </Link>
          <Button variant="outline" loading={downloading} onClick={download}>
            {!downloading && <Download />} {downloading ? "Preparing" : "Download pass"}
          </Button>
          <Button variant="outline" onClick={calendar}>
            <CalendarDays /> Add to calendar
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {copied ? "Booking ID copied" : ""}
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <CarFront className="car-park-animation size-6 text-primary" />
          <span>Gate</span>
          <ArrowRight className="size-3" />
          <span className="border border-selected/50 bg-selected/10 px-3 py-2 text-selected">
            A12
          </span>
        </div>
      </div>
    </PageFrame>
  );
}

export function BookingsPage() {
  const [tab, setTab] = useState("Upcoming");
  const tabs = ["Upcoming", "Active", "Completed", "Cancelled"];
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
        {tab === "Upcoming" ? (
          <BookingCard />
        ) : tab === "Active" ? (
          <ActiveParking />
        ) : (
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
        )}
      </div>
    </PageFrame>
  );
}

function BookingCard() {
  return (
    <article className="interactive-lift grid gap-6 border border-border bg-surface p-6 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="flex items-center gap-3">
          <StatusBadge status="reserved" />
          <span className="font-mono text-xs text-muted-foreground">SP-20260920-10231</span>
        </div>
        <div className="mt-5 flex items-end gap-4">
          <strong className="font-display text-5xl">A12</strong>
          <span className="mb-1 text-sm text-muted-foreground">Floor 1 · Zone A</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <span>20 Sep · 10:00 AM</span>
          <span>MH12AB1234</span>
          <span>₹118</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/bookings">
          <Button variant="outline">View</Button>
        </Link>
        <Link to="/confirmation">
          <Button>QR Pass</Button>
        </Link>
      </div>
    </article>
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
          ].map((x, i) => (
            <Button
              key={x}
              variant={i === 0 ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                if (x === "Logout") {
                  sessionStorage.removeItem("parkgrid_authenticated");
                  sessionStorage.removeItem("parkgrid_seen_intro");
                  window.dispatchEvent(new CustomEvent("parkgrid-logout"));
                  toast.info("Logged out of ParkGrid");
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
          ))}
        </aside>
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
              <input className="field-input" defaultValue="MH12AB1234" />
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
