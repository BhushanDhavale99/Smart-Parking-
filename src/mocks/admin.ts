/**
 * ============================================================================
 * ParkGrid One - Admin Operations Mock Data
 * ============================================================================
 * NOTICE: All datasets in this file are simulated DEMO DATA for administrative
 * prototypes and operational previews. Real database integration is used
 * exclusively for the Users page via public.profiles with RLS policies.
 * ============================================================================
 */

export interface AdminDashboardKPIs {
  occupancyPercent: number;
  totalSlots: number;
  occupiedSlots: number;
  activeSessions: number;
  todayRevenue: number;
  bookingsToday: number;
  evChargingActive: number;
  turnoverRate: string;
}

export interface ChartDataPoint {
  time: string;
  occupancy: number;
  revenue: number;
  bookings: number;
}

export interface AdminAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  timestamp: string;
  source: string;
}

export type AdminSlotStatus = "free" | "booked" | "occupied" | "blocked" | "maintenance";
export type AdminSlotType = "standard" | "ev" | "accessible" | "valet";

export interface AdminSlot {
  id: string;
  code: string;
  level: "B2" | "B1" | "G1" | "L1" | "L2";
  zone: string;
  type: AdminSlotType;
  status: AdminSlotStatus;
  currentVehiclePlate?: string | undefined;
  parkedSince?: string | undefined;
  hourlyRate: number;
  evPowerKw?: number | undefined;
}

export interface AdminBooking {
  id: string;
  reference: string;
  guestName: string;
  vehiclePlate: string;
  slotCode: string;
  level: string;
  startTime: string;
  endTime: string;
  amount: number;
  status: "confirmed" | "active" | "completed" | "cancelled";
  paymentStatus: "paid" | "pending" | "refunded";
  notes?: string | undefined;
}

export interface AdminSession {
  id: string;
  vehiclePlate: string;
  vehicleType: "Car" | "SUV" | "EV" | "Motorcycle";
  slotCode: string;
  level: string;
  entryGate: string;
  exitGate?: string | undefined;
  entryTime: string;
  exitTime?: string | undefined;
  durationMinutes: number;
  feeAmount: number;
  status: "in_progress" | "completed";
}

// ---------------------------------------------------------------------------
// 1. Dashboard Metrics & Trends
// ---------------------------------------------------------------------------

export const ADMIN_DASHBOARD_KPIS: AdminDashboardKPIs = {
  occupancyPercent: 84,
  totalSlots: 150,
  occupiedSlots: 126,
  activeSessions: 126,
  todayRevenue: 54820,
  bookingsToday: 98,
  evChargingActive: 6,
  turnoverRate: "3.2x / bay",
};

export const ADMIN_HOURLY_CHART: ChartDataPoint[] = [
  { time: "00:00", occupancy: 28, revenue: 1400, bookings: 4 },
  { time: "02:00", occupancy: 22, revenue: 950, bookings: 2 },
  { time: "04:00", occupancy: 18, revenue: 720, bookings: 1 },
  { time: "06:00", occupancy: 35, revenue: 2100, bookings: 8 },
  { time: "08:00", occupancy: 72, revenue: 5800, bookings: 22 },
  { time: "10:00", occupancy: 91, revenue: 8400, bookings: 19 },
  { time: "12:00", occupancy: 88, revenue: 7600, bookings: 14 },
  { time: "14:00", occupancy: 94, revenue: 9100, bookings: 16 },
  { time: "16:00", occupancy: 89, revenue: 8200, bookings: 11 },
  { time: "18:00", occupancy: 84, revenue: 6400, bookings: 9 },
  { time: "20:00", occupancy: 62, revenue: 4250, bookings: 6 },
  { time: "22:00", occupancy: 44, revenue: 2800, bookings: 4 },
];

export const ADMIN_ALERTS: AdminAlert[] = [
  {
    id: "alt-01",
    severity: "warning",
    title: "High EV Hub Utilization",
    description: "All 6 high-speed DC chargers on Level G1 are operating at 95% capacity.",
    timestamp: "10 mins ago",
    source: "EV Energy Management",
  },
  {
    id: "alt-02",
    severity: "info",
    title: "Gate 2 QR Scanner Auto-Calibrated",
    description: "Entry lane 2 barrier latency normalized to 180ms.",
    timestamp: "24 mins ago",
    source: "Hardware Gateway",
  },
  {
    id: "alt-03",
    severity: "critical",
    title: "Bay B1-14 Sensor Offline",
    description: "Ultrasonic presence sensor reported telemetry packet timeout.",
    timestamp: "45 mins ago",
    source: "IoT Mesh Node 4",
  },
  {
    id: "alt-04",
    severity: "info",
    title: "Scheduled Maintenance Tonight",
    description: "Routine firmware synchronization scheduled at 02:30 IST.",
    timestamp: "2 hours ago",
    source: "Facility Ops",
  },
];

// ---------------------------------------------------------------------------
// 2. Live Slot Map & Bays (150 slots across 5 levels)
// ---------------------------------------------------------------------------

const LEVELS: Array<AdminSlot["level"]> = ["B2", "B1", "G1", "L1", "L2"];
const PLATES = [
  "MH 02 FJ 4819",
  "MH 01 DK 9021",
  "MH 03 BV 1104",
  "MH 47 AE 6720",
  "MH 04 CG 3391",
  "MH 12 QP 5541",
  "DL 10 CE 8820",
  "MH 43 AB 1928",
  "KA 05 MN 4401",
  "MH 02 ZX 7712",
];

export const ADMIN_SLOTS: AdminSlot[] = [];

// Seed 30 slots per level = 150 total
LEVELS.forEach((level) => {
  for (let i = 1; i <= 30; i++) {
    const code = `${level}-${String(i).padStart(2, "0")}`;
    const isEv = (level === "G1" || level === "B1") && i <= 6;
    const isAccessible = i === 7 || i === 8;
    const isValet = level === "G1" && i >= 25;

    let type: AdminSlotType = "standard";
    if (isEv) type = "ev";
    else if (isAccessible) type = "accessible";
    else if (isValet) type = "valet";

    // Distribute realistic status
    let status: AdminSlotStatus = "free";
    const mod = (i * 7 + level.charCodeAt(0) + level.charCodeAt(1)) % 10;
    if (mod < 5) status = "occupied";
    else if (mod < 7) status = "free";
    else if (mod === 7) status = "booked";
    else if (mod === 8) status = i === 14 ? "maintenance" : "occupied";
    else status = "blocked";

    const isParked = status === "occupied";
    const plate = isParked ? PLATES[(i + level.charCodeAt(1)) % PLATES.length] : undefined;

    ADMIN_SLOTS.push({
      id: `slot-${code.toLowerCase()}`,
      code,
      level,
      zone: i <= 15 ? "Zone Alpha" : "Zone Beta",
      type,
      status,
      currentVehiclePlate: plate,
      parkedSince: isParked ? `${(i % 4) + 1}h ${(i * 11) % 50}m ago` : undefined,
      hourlyRate: isEv ? 170 : isValet ? 220 : 150,
      evPowerKw: isEv && isParked ? (i % 2 === 0 ? 60 : 22) : undefined,
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Bookings Mock Dataset
// ---------------------------------------------------------------------------

export const ADMIN_BOOKINGS: AdminBooking[] = [
  {
    id: "bk-901",
    reference: "PG-2026-9014",
    guestName: "Vikram Malhotra",
    vehiclePlate: "MH 02 FJ 4819",
    slotCode: "G1-03",
    level: "G1",
    startTime: "2026-10-11T09:30:00+05:30",
    endTime: "2026-10-11T13:30:00+05:30",
    amount: 680,
    status: "active",
    paymentStatus: "paid",
    notes: "EV fast charge reservation requested.",
  },
  {
    id: "bk-902",
    reference: "PG-2026-9015",
    guestName: "Ananya Deshmukh",
    vehiclePlate: "MH 01 DK 9021",
    slotCode: "B1-08",
    level: "B1",
    startTime: "2026-10-11T10:00:00+05:30",
    endTime: "2026-10-11T18:00:00+05:30",
    amount: 1200,
    status: "active",
    paymentStatus: "paid",
    notes: "Accessible ramp priority bay.",
  },
  {
    id: "bk-903",
    reference: "PG-2026-9016",
    guestName: "Rohan Singhania",
    vehiclePlate: "MH 03 BV 1104",
    slotCode: "L1-12",
    level: "L1",
    startTime: "2026-10-11T11:15:00+05:30",
    endTime: "2026-10-11T14:15:00+05:30",
    amount: 450,
    status: "active",
    paymentStatus: "paid",
  },
  {
    id: "bk-904",
    reference: "PG-2026-9017",
    guestName: "Pooja Mehta",
    vehiclePlate: "MH 47 AE 6720",
    slotCode: "B2-05",
    level: "B2",
    startTime: "2026-10-11T14:00:00+05:30",
    endTime: "2026-10-11T17:00:00+05:30",
    amount: 450,
    status: "confirmed",
    paymentStatus: "paid",
  },
  {
    id: "bk-905",
    reference: "PG-2026-9018",
    guestName: "Kabir Wadhwa",
    vehiclePlate: "MH 04 CG 3391",
    slotCode: "G1-26",
    level: "G1",
    startTime: "2026-10-11T15:30:00+05:30",
    endTime: "2026-10-11T20:30:00+05:30",
    amount: 1100,
    status: "confirmed",
    paymentStatus: "paid",
    notes: "Valet drop-off assigned.",
  },
  {
    id: "bk-906",
    reference: "PG-2026-9019",
    guestName: "Tanvi Kulkarni",
    vehiclePlate: "MH 12 QP 5541",
    slotCode: "L2-19",
    level: "L2",
    startTime: "2026-10-11T08:00:00+05:30",
    endTime: "2026-10-11T10:30:00+05:30",
    amount: 375,
    status: "completed",
    paymentStatus: "paid",
  },
  {
    id: "bk-907",
    reference: "PG-2026-9020",
    guestName: "Aditya Shah",
    vehiclePlate: "DL 10 CE 8820",
    slotCode: "B1-18",
    level: "B1",
    startTime: "2026-10-11T07:30:00+05:30",
    endTime: "2026-10-11T09:00:00+05:30",
    amount: 225,
    status: "completed",
    paymentStatus: "paid",
  },
  {
    id: "bk-908",
    reference: "PG-2026-9021",
    guestName: "Meera Nair",
    vehiclePlate: "MH 43 AB 1928",
    slotCode: "G1-05",
    level: "G1",
    startTime: "2026-10-11T12:00:00+05:30",
    endTime: "2026-10-11T13:00:00+05:30",
    amount: 170,
    status: "cancelled",
    paymentStatus: "refunded",
    notes: "Cancelled within 100% refund window.",
  },
  {
    id: "bk-909",
    reference: "PG-2026-9022",
    guestName: "Karthik Pillai",
    vehiclePlate: "KA 05 MN 4401",
    slotCode: "L1-04",
    level: "L1",
    startTime: "2026-10-11T16:00:00+05:30",
    endTime: "2026-10-11T19:00:00+05:30",
    amount: 450,
    status: "confirmed",
    paymentStatus: "paid",
  },
  {
    id: "bk-910",
    reference: "PG-2026-9023",
    guestName: "Zoya Shaikh",
    vehiclePlate: "MH 02 ZX 7712",
    slotCode: "B2-21",
    level: "B2",
    startTime: "2026-10-11T17:00:00+05:30",
    endTime: "2026-10-11T21:00:00+05:30",
    amount: 600,
    status: "confirmed",
    paymentStatus: "paid",
  },
];

// ---------------------------------------------------------------------------
// 4. Entry/Exit Sessions Mock Dataset
// ---------------------------------------------------------------------------

export const ADMIN_SESSIONS: AdminSession[] = [
  {
    id: "ses-101",
    vehiclePlate: "MH 02 FJ 4819",
    vehicleType: "EV",
    slotCode: "G1-03",
    level: "G1",
    entryGate: "Gate 1 (BKC Main)",
    entryTime: "2026-10-11T09:28:14+05:30",
    durationMinutes: 175,
    feeAmount: 680,
    status: "in_progress",
  },
  {
    id: "ses-102",
    vehiclePlate: "MH 01 DK 9021",
    vehicleType: "SUV",
    slotCode: "B1-08",
    level: "B1",
    entryGate: "Gate 2 (Avenue 3)",
    entryTime: "2026-10-11T10:02:40+05:30",
    durationMinutes: 141,
    feeAmount: 1200,
    status: "in_progress",
  },
  {
    id: "ses-103",
    vehiclePlate: "MH 03 BV 1104",
    vehicleType: "Car",
    slotCode: "L1-12",
    level: "L1",
    entryGate: "Gate 1 (BKC Main)",
    entryTime: "2026-10-11T11:14:02+05:30",
    durationMinutes: 69,
    feeAmount: 450,
    status: "in_progress",
  },
  {
    id: "ses-104",
    vehiclePlate: "MH 12 QP 5541",
    vehicleType: "Car",
    slotCode: "L2-19",
    level: "L2",
    entryGate: "Gate 1 (BKC Main)",
    exitGate: "Gate 1 Out",
    entryTime: "2026-10-11T08:01:22+05:30",
    exitTime: "2026-10-11T10:32:05+05:30",
    durationMinutes: 151,
    feeAmount: 375,
    status: "completed",
  },
  {
    id: "ses-105",
    vehiclePlate: "DL 10 CE 8820",
    vehicleType: "SUV",
    slotCode: "B1-18",
    level: "B1",
    entryGate: "Gate 2 (Avenue 3)",
    exitGate: "Gate 2 Out",
    entryTime: "2026-10-11T07:29:18+05:30",
    exitTime: "2026-10-11T08:58:49+05:30",
    durationMinutes: 89,
    feeAmount: 225,
    status: "completed",
  },
  {
    id: "ses-106",
    vehiclePlate: "MH 04 CG 3391",
    vehicleType: "Car",
    slotCode: "G1-26",
    level: "G1",
    entryGate: "Valet Portico",
    entryTime: "2026-10-11T11:45:10+05:30",
    durationMinutes: 38,
    feeAmount: 330,
    status: "in_progress",
  },
  {
    id: "ses-107",
    vehiclePlate: "MH 47 AE 6720",
    vehicleType: "EV",
    slotCode: "B1-02",
    level: "B1",
    entryGate: "Gate 1 (BKC Main)",
    entryTime: "2026-10-11T12:05:00+05:30",
    durationMinutes: 18,
    feeAmount: 170,
    status: "in_progress",
  },
];
