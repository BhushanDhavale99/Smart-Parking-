export type SlotStatus =
  "available" | "occupied" | "reserved" | "selected" | "maintenance" | "blocked";

export type FloorCategory = "basement" | "ground" | "upper";

export type LevelCode = "B2" | "B1" | "G1" | "L1" | "L2";

/** Canonical level configuration for ParkGrid One */
export const LEVEL_CONFIG: Record<
  LevelCode,
  {
    label: LevelCode;
    name: string;
    category: FloorCategory;
    allowsHeavy: boolean;
    sortOrder: number;
  }
> = {
  B2: {
    label: "B2",
    name: "Basement Level 2",
    category: "basement",
    allowsHeavy: true,
    sortOrder: 1,
  },
  B1: {
    label: "B1",
    name: "Basement Level 1",
    category: "basement",
    allowsHeavy: true,
    sortOrder: 2,
  },
  G1: { label: "G1", name: "Ground Floor", category: "ground", allowsHeavy: true, sortOrder: 3 },
  L1: {
    label: "L1",
    name: "Upper Deck Level 1",
    category: "upper",
    allowsHeavy: false,
    sortOrder: 4,
  },
  L2: {
    label: "L2",
    name: "Upper Deck Level 2",
    category: "upper",
    allowsHeavy: false,
    sortOrder: 5,
  },
};

/** Backwards-compatible FLOOR_CONFIG mapping level codes */
export const FLOOR_CONFIG = LEVEL_CONFIG;

export type ParkingSlotData = {
  id: string; // Canonical bay code, e.g. "B2-01"
  code: string;
  slotId?: string;
  levelCode: LevelCode;
  floor: number; // 1-5 sort order index
  row: number; // zero-based row for 3D grid layout
  col: number; // zero-based col for 3D grid layout
  zone: "A" | "B" | "EV";
  status: SlotStatus;
  type: "Car" | "Bike" | "EV" | "Accessible";
  slotType: "standard" | "ev" | "accessible";
  price: number; // In Rupees (hourlyRatePaise / 100)
  hourlyRatePaise: number;
  hasEvCharger: boolean;
  adminStatus: "active" | "maintenance" | "blocked";
  notes?: string | null;
};

const LEVELS: LevelCode[] = ["B2", "B1", "G1", "L1", "L2"];

/**
 * 150 canonical parking slots (30 per level across 5 levels).
 * - 12 EV charger bays (bays 01-06 on B1 & G1, ₹70/hr)
 * - 10 Accessible bays (bays 07-08 on all 5 levels, ₹50/hr)
 * - 128 Standard bays (₹50/hr)
 * All active slots default to 'available' until real-time bookings apply.
 */
export const parkingSlots: ParkingSlotData[] = LEVELS.flatMap((levelCode, levelIndex) => {
  return Array.from({ length: 30 }, (_, index) => {
    const bayNumber = index + 1;
    const code = `${levelCode}-${String(bayNumber).padStart(2, "0")}`;
    const isEv = (levelCode === "G1" || levelCode === "B1") && bayNumber <= 6;
    const isAccessible = bayNumber === 7 || bayNumber === 8;

    let zone: "A" | "B" | "EV" = "A";
    if (isEv) {
      zone = "EV";
    } else if (levelCode === "G1" || levelCode === "B1") {
      zone = bayNumber <= 18 ? "A" : "B";
    } else {
      zone = bayNumber <= 15 ? "A" : "B";
    }

    const slotType: "standard" | "ev" | "accessible" = isEv
      ? "ev"
      : isAccessible
        ? "accessible"
        : "standard";

    const displayType: "Car" | "Bike" | "EV" | "Accessible" = isEv
      ? "EV"
      : isAccessible
        ? "Accessible"
        : "Car";

    const hourlyRatePaise = isEv ? 7000 : 5000;

    return {
      id: code,
      code,
      levelCode,
      floor: levelIndex + 1,
      row: Math.floor(index / 6), // 5 rows of 6 slots per level
      col: index % 6,
      zone,
      status: "available" as SlotStatus,
      type: displayType,
      slotType,
      price: hourlyRatePaise / 100,
      hourlyRatePaise,
      hasEvCharger: isEv,
      adminStatus: "active" as const,
    };
  });
});

export const facility = {
  name: "ParkGrid One",
  location: "Bandra Kurla Complex, Mumbai",
  address: "Bandra Kurla Complex, Mumbai, Maharashtra",
  slots: 150,
  available: 150,
  occupied: 0,
  reserved: 0,
};

export const facilities = [
  ["CCTV Security", "Continuous coverage across every floor and entrance."],
  ["24/7 Monitoring", "On-site response team and intelligent alerts."],
  ["EV Charging", "Twelve fast chargers across Ground and Basement levels."],
  ["Accessible Parking", "Wide priority bays beside lifts on every level."],
  ["Digital Payments", "UPI, cards, and secure digital receipts."],
  ["QR Entry", "Fast, contactless entry with your parking pass."],
  ["Smart Guidance", "Live signs guide you directly to your bay."],
  ["Emergency Assistance", "One-touch help points throughout the facility."],
] as const;
