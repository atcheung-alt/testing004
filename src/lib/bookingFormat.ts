// -----------------------------------------------------------------------------
// Pure booking-system constants/helpers with NO server-only imports (no
// `@/lib/prisma`, no Node built-ins) — safe to import from "use client"
// components (the admin slot-duration slider, the public per-event booking
// page, etc.) as well as from src/lib/bookings.ts (which re-exports these
// alongside its raw-SQL data-access functions). Keeping this split avoids
// bundling the Prisma client into the browser the way a client component
// importing straight from src/lib/bookings.ts would.
// -----------------------------------------------------------------------------

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED";
export const VALID_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "REJECTED"];
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

export const DECIDABLE_FROM_STATUS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [],
  REJECTED: [],
};

// Staff type the appointment length in minutes. Any whole number from 1 to
// 8 hours is allowed — it is not limited to 15, 30, 45, or 60.
export const SLOT_DURATION_MIN_MINUTES = 1;
export const SLOT_DURATION_MAX_MINUTES = 480; // 8 hours — covers a full-day workshop session
export const SLOT_DURATION_STEP_MINUTES = 1;
export const DEFAULT_SLOT_DURATION_MINUTES = 60;

export const MAX_SLOT_QUOTA = 500;

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isDateBookable(date: Date): boolean {
  return date.getTime() >= startOfToday().getTime();
}

export function isSlotInFuture(date: Date, time: string): boolean {
  const [h, m] = time.split(":").map(Number);
  const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h || 0, m || 0);
  return slotStart.getTime() > Date.now();
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function addMinutesToTime(time: string, minutes: number): string {
  const total = minutesOf(time) + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "2:00 PM" — used where the date is already shown separately. */
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2000, 0, 1, h || 0, m || 0)
  );
}

/** "2:00 PM – 3:30 PM" for a slot's start time + duration. */
export function formatTimeRangeLabel(startTime: string, durationMins: number): string {
  return `${formatTimeLabel(startTime)} – ${formatTimeLabel(addMinutesToTime(startTime, durationMins))}`;
}

/** "24/08/2026" — the app's standard DD/MM/YYYY date format. */
export function formatDateLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "24/08/2026 at 2:00 PM – 3:30 PM". */
export function formatSlotLabel(date: Date | string, startTime: string, durationMins: number): string {
  return `${formatDateLabel(date)} at ${formatTimeRangeLabel(startTime, durationMins)}`;
}

/** "1h 30m" / "45m" / "2h" — the slider's live label as staff drags it. */
export function formatDurationLabel(durationMins: number): string {
  const h = Math.floor(durationMins / 60);
  const m = durationMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Reads a fetch Response as JSON, throwing a clean Error either way —
 * `data.error` (or `fallbackMessage`) when `!res.ok`, or `fallbackMessage`
 * itself if the body isn't valid JSON at all. Without this, a response body
 * that isn't JSON (an HTML error page from a proxy/CDN/WAF in front of the
 * app, a stale deploy briefly serving an error page, etc.) makes `res.json()`
 * throw its own raw, browser-specific parse error — e.g. Safari phrases this
 * as "The string did not match the expected pattern." — straight into
 * whatever `catch (err) { setError(err.message) }` block called this,
 * showing the visitor a cryptic string instead of a normal error message.
 * Every "use client" fetch call in the booking system should read its
 * response through this rather than calling `res.json()` directly.
 */
export async function readJsonOrThrow(
  res: Response,
  fallbackMessage = "Something went wrong. Please try again."
): Promise<any> {
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(fallbackMessage);
  }
  if (!res.ok) throw new Error(data?.error || fallbackMessage);
  return data;
}

// -----------------------------------------------------------------------------
// Calendar invite helper — a "confirmed" booking email gets an "Add to
// Google Calendar" button (see sendDocumentEmail's secondaryCtaUrl in
// src/lib/mailer.ts and the two call sites in the /api/public/bookings and
// /api/bookings/[id] routes). Pure string-building, no Buffer/Node built-ins,
// so this stays safe to import from "use client" code even though only
// server routes actually use it today.
// -----------------------------------------------------------------------------

/** Every slot date/time in this app is stored and displayed as Hong Kong
 *  wall-clock time (see the schema comment on BookingSlot — no UTC
 *  conversion happens anywhere else), and Hong Kong has no DST, so a fixed
 *  UTC+8 offset is always correct here. `date`'s Y/M/D components (not its
 *  own UTC fields) are the intended calendar date, same assumption every
 *  other formatter in this file already makes. */
function hkLocalToUtcDate(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h || 0, m || 0) - 8 * 60 * 60 * 1000
  );
}

function icsUtcStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** A Google Calendar "quick add" link — clicking it opens Google Calendar
 *  with this booking's title/time/details already filled in, one more click
 *  away from being saved. Works as a plain link/button in any email client. */
export function buildGoogleCalendarUrl(args: {
  eventName: string;
  date: Date;
  startTime: string;
  durationMins: number;
  details?: string;
}): string {
  const start = hkLocalToUtcDate(args.date, args.startTime);
  const end = new Date(start.getTime() + args.durationMins * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: args.eventName,
    dates: `${icsUtcStamp(start)}/${icsUtcStamp(end)}`,
  });
  if (args.details) params.set("details", args.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export type AvailabilityLevel = "OPEN" | "FEW" | "FULL";

/** Buckets a day's open-spot count into three tiers for the public booking
 *  calendar's at-a-glance coloring — "few left" is anything at or below a
 *  quarter of the day's total quota (rounded up). */
export function availabilityLevel(available: number, total: number): AvailabilityLevel {
  if (total <= 0 || available <= 0) return "FULL";
  if (available <= Math.ceil(total * 0.25)) return "FEW";
  return "OPEN";
}
