// ── Indian Standard Time (Asia/Kolkata +05:30) & Currency Utilities ──

/**
 * Builds a Date object in Asia/Kolkata timezone from a local date string (YYYY-MM-DD)
 * and time string (HH:MM).
 */
export function createIstDateTime(dateStr: string, timeStr: string): Date {
  // ISO-8601 offset for IST (+05:30, no Daylight Saving Time)
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${normalizedTime}+05:30`);
}

/**
 * Aligns a Date object to the nearest 15-minute boundary in IST (rounded up).
 */
export function alignToNext15Minutes(date: Date): Date {
  const ms = 1000 * 60 * 15;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Formats a UTC timestamp into human-readable IST date and time.
 */
export function formatIstDateTime(
  utcIsoString: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof utcIsoString === "string" ? new Date(utcIsoString) : utcIsoString;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  return new Intl.DateTimeFormat("en-IN", { ...defaultOptions, ...options }).format(d);
}

/**
 * Formats a UTC timestamp into IST date only (e.g. "20 Sep 2026").
 */
export function formatIstDate(utcIsoString: string | Date): string {
  return formatIstDateTime(utcIsoString, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: undefined,
    minute: undefined,
  });
}

/**
 * Formats a UTC timestamp into IST time only (e.g. "10:00 AM").
 */
export function formatIstTime(utcIsoString: string | Date): string {
  return formatIstDateTime(utcIsoString, {
    day: undefined,
    month: undefined,
    year: undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Formats integer paise to Rupees (e.g. 11800 paise -> "₹118").
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2)}`;
}

/**
 * Validates that an incoming timestamp string is an ISO-8601 string
 * and normalizes it to UTC format (ending in 'Z').
 * Logs a warning if a string without explicit offset is provided.
 */
export function ensureUtcIsoString(timestamp: string, paramName: string = "timestamp"): string {
  if (!timestamp || typeof timestamp !== "string") {
    throw new Error(`Invalid ${paramName}: timestamp string required.`);
  }

  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ${paramName}: unable to parse date/time string "${timestamp}".`);
  }

  // Detect strings that lack timezone offset (e.g., "2026-10-20T17:00:00")
  const hasTimezoneDesignator = /Z|[+-]\d{2}(?::?\d{2})?$/i.test(timestamp.trim());
  if (!hasTimezoneDesignator) {
    console.warn(
      `[Timezone Warning] ${paramName} ("${timestamp}") lacks explicit UTC/offset designator. Normalizing to UTC ISO.`,
    );
  }

  return d.toISOString();
}

