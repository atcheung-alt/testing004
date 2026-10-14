import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/settings";
import { generateSigningToken } from "@/lib/signing";
import {
  addMinutesToTime,
  dateKey,
  formatDateLabel,
  formatDurationLabel,
  formatSlotLabel,
  formatTimeLabel,
  formatTimeRangeLabel,
  isDateBookable,
  isSlotInFuture,
  isValidTimeString,
  minutesOf,
  parseDateOnly,
  DECIDABLE_FROM_STATUS,
  DEFAULT_SLOT_DURATION_MINUTES,
  MAX_SLOT_QUOTA,
  SLOT_DURATION_MAX_MINUTES,
  SLOT_DURATION_MIN_MINUTES,
  VALID_BOOKING_STATUSES,
  type BookingStatus,
} from "@/lib/bookingFormat";

// Re-exported so every existing `from "@/lib/bookings"` import (API routes,
// server components) keeps working unchanged — only "use client" components
// need to import the pure pieces from "@/lib/bookingFormat" directly instead,
// to avoid pulling this file's `@/lib/prisma` import into the browser bundle.
export {
  addMinutesToTime,
  dateKey,
  formatDateLabel,
  formatDurationLabel,
  formatSlotLabel,
  formatTimeLabel,
  formatTimeRangeLabel,
  isDateBookable,
  isSlotInFuture,
  isValidTimeString,
  minutesOf,
  parseDateOnly,
  DECIDABLE_FROM_STATUS,
  DEFAULT_SLOT_DURATION_MINUTES,
  MAX_SLOT_QUOTA,
  SLOT_DURATION_MAX_MINUTES,
  SLOT_DURATION_MIN_MINUTES,
  VALID_BOOKING_STATUSES,
};
export type { BookingStatus };
export {
  SLOT_DURATION_STEP_MINUTES,
  BOOKING_STATUS_LABELS,
  type AvailabilityLevel,
  availabilityLevel,
  buildGoogleCalendarUrl,
} from "@/lib/bookingFormat";

// -----------------------------------------------------------------------------
// The event-based booking system (see prisma/schema.prisma for
// BookingEvent/BookingSlot/Booking) — replaces the old single-resource,
// fixed-9am-9pm massage calendar. Staff create a BookingEvent for whatever's
// being offered, add BookingSlot rows under it (each its own day + start
// time + custom duration + quota), and clients book against a specific slot
// from that event's own public page (src/app/book/[id]/page.tsx).
//
// All three models are read/written here via raw SQL ($queryRaw/$executeRaw)
// rather than generated `prisma.*` delegates, the same approach used for the
// Event model in src/lib/events.ts — see that file's header comment. Here
// it's not just "generate hasn't been re-run yet" but also "the old Booking
// model already has a stale generated shape in this sandbox (date/startTime/
// durationMins, no slotId) that doesn't match the new one", so raw SQL
// sidesteps needing to hand-patch that generated stub at all.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// BookingEvent
// -----------------------------------------------------------------------------

export type BookingEventRecord = {
  id: string;
  companyId: string | null;
  name: string;
  description: string;
  companyName: string;
  startDate: Date;
  endDate: Date;
  active: boolean;
  requiresConfirmation: boolean;
  manageToken: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listBookingEvents(opts?: { activeOnly?: boolean }): Promise<BookingEventRecord[]> {
  if (opts?.activeOnly) {
    return prisma.$queryRaw<BookingEventRecord[]>`
      SELECT * FROM "BookingEvent" WHERE "active" = true ORDER BY "startDate" ASC
    `;
  }
  return prisma.$queryRaw<BookingEventRecord[]>`
    SELECT * FROM "BookingEvent" ORDER BY "startDate" DESC
  `;
}

export async function getBookingEvent(id: string): Promise<BookingEventRecord | null> {
  const rows = await prisma.$queryRaw<BookingEventRecord[]>`
    SELECT * FROM "BookingEvent" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

/** Looks up an event by its public manage-link token — the only entry point
 *  for src/app/manage-booking/[token]/page.tsx (no login, no event id in the
 *  URL at all). Returns null for both "no such token" and "token not
 *  generated yet" alike, which the page treats identically as a 404. */
export async function getBookingEventByManageToken(manageToken: string): Promise<BookingEventRecord | null> {
  const rows = await prisma.$queryRaw<BookingEventRecord[]>`
    SELECT * FROM "BookingEvent" WHERE "manageToken" = ${manageToken} LIMIT 1
  `;
  return rows[0] || null;
}

/** Ensures an event has a manage-link token, generating and persisting one
 *  if it doesn't yet (events created before this feature shipped). Returns
 *  the token, or null if the event doesn't exist. Same lazy-backfill idea as
 *  ensureSigningToken/ensureLeaveToken/etc. in src/lib/signing.ts, just
 *  implemented here via raw SQL like the rest of this file. */
export async function ensureBookingEventManageToken(eventId: string): Promise<string | null> {
  const event = await getBookingEvent(eventId);
  if (!event) return null;
  if (event.manageToken) return event.manageToken;

  const manageToken = generateSigningToken();
  await prisma.$executeRaw`
    UPDATE "BookingEvent" SET "manageToken" = ${manageToken} WHERE "id" = ${eventId}
  `;
  return manageToken;
}

export type BookingEventFields = {
  name: string;
  description: string;
  companyName: string;
  startDate: Date | null;
  endDate: Date | null;
  error: string | null;
};

/** Validates a create/edit submission for a BookingEvent — name, company,
 *  and both dates required, end on/after start. */
export function bookingEventFieldsFrom(body: any): BookingEventFields {
  const fail = (error: string): BookingEventFields => ({
    name: "",
    description: "",
    companyName: "",
    startDate: null,
    endDate: null,
    error,
  });

  const name = (body.name || "").trim();
  if (!name) return fail("Please enter a name for this event.");

  const companyName = (body.companyName || "").trim();
  if (!companyName) return fail("Please enter which company this event is for.");

  const description = (body.description || "").trim();

  const startDate = parseDateOnly(body.startDate);
  if (!startDate) return fail("Please pick a start date.");
  const endDate = parseDateOnly(body.endDate);
  if (!endDate) return fail("Please pick an end date.");
  if (endDate.getTime() < startDate.getTime()) {
    return fail("The end date can't be before the start date.");
  }

  return { name, description, companyName, startDate, endDate, error: null };
}

export async function createBookingEvent(fields: {
  name: string;
  description: string;
  companyName: string;
  startDate: Date;
  endDate: Date;
  active?: boolean;
  requiresConfirmation?: boolean;
  companyId?: string | null;
}): Promise<BookingEventRecord> {
  const id = randomUUID();
  const active = fields.active ?? true;
  const requiresConfirmation = fields.requiresConfirmation ?? false;
  const manageToken = generateSigningToken();
  const rows = await prisma.$queryRaw<BookingEventRecord[]>`
    INSERT INTO "BookingEvent" ("id", "name", "description", "companyName", "companyId", "startDate", "endDate", "active", "requiresConfirmation", "manageToken", "createdAt", "updatedAt")
    VALUES (${id}, ${fields.name}, ${fields.description}, ${fields.companyName}, ${fields.companyId || null}, ${fields.startDate}, ${fields.endDate}, ${active}, ${requiresConfirmation}, ${manageToken}, now(), now())
    RETURNING *
  `;
  return rows[0];
}

export async function updateBookingEvent(
  id: string,
  fields: {
    name: string;
    description: string;
    companyName: string;
    startDate: Date;
    endDate: Date;
    active: boolean;
    requiresConfirmation: boolean;
  }
): Promise<BookingEventRecord | null> {
  const rows = await prisma.$queryRaw<BookingEventRecord[]>`
    UPDATE "BookingEvent"
    SET "name" = ${fields.name}, "description" = ${fields.description}, "companyName" = ${fields.companyName},
        "startDate" = ${fields.startDate}, "endDate" = ${fields.endDate}, "active" = ${fields.active},
        "requiresConfirmation" = ${fields.requiresConfirmation}, "updatedAt" = now()
    WHERE "id" = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function setBookingEventActive(id: string, active: boolean): Promise<BookingEventRecord | null> {
  const rows = await prisma.$queryRaw<BookingEventRecord[]>`
    UPDATE "BookingEvent" SET "active" = ${active}, "updatedAt" = now() WHERE "id" = ${id} RETURNING *
  `;
  return rows[0] || null;
}

/** Permanently deletes an event and (via cascade) every slot and booking
 *  under it. Callers must check countActiveBookingsForEvent first — this
 *  function does not re-check. */
export async function deleteBookingEvent(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "BookingEvent" WHERE "id" = ${id}`;
}

// -----------------------------------------------------------------------------
// BookingSlot
// -----------------------------------------------------------------------------

export type BookingSlotRecord = {
  id: string;
  eventId: string;
  date: Date;
  startTime: string;
  durationMins: number;
  quota: number;
  createdAt: Date;
};

/** A slot plus how many of its quota are currently taken by a non-cancelled/
 *  non-rejected booking — `available` is always `quota - taken`, floored at
 *  0 (shouldn't go negative in practice, but a slot's quota could in theory
 *  be lowered after bookings already exist against it). */
export type BookingSlotWithAvailability = BookingSlotRecord & { taken: number; available: number };

function withAvailability(row: BookingSlotRecord & { taken: bigint | number }): BookingSlotWithAvailability {
  const taken = Number(row.taken) || 0;
  return { ...row, taken, available: Math.max(0, row.quota - taken) };
}

/** Every slot for an event, earliest first, annotated with how many bookings
 *  currently hold each one — the admin detail page's slot list, and the
 *  public per-event page's day/slot pickers, both use this. */
export async function listSlotsForEvent(eventId: string): Promise<BookingSlotWithAvailability[]> {
  const rows = await prisma.$queryRaw<(BookingSlotRecord & { taken: bigint })[]>`
    SELECT s.*, COALESCE(bc.taken, 0) AS "taken"
    FROM "BookingSlot" s
    LEFT JOIN (
      SELECT "slotId", COUNT(*) AS taken FROM "Booking" WHERE status IN ('PENDING', 'CONFIRMED') GROUP BY "slotId"
    ) bc ON bc."slotId" = s.id
    WHERE s."eventId" = ${eventId}
    ORDER BY s."date" ASC, s."startTime" ASC
  `;
  return rows.map(withAvailability);
}

/** Just one event's slots on one specific day — the public page's slot list
 *  once a date is picked. */
export async function listSlotsForEventOnDate(eventId: string, date: Date): Promise<BookingSlotWithAvailability[]> {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const rows = await prisma.$queryRaw<(BookingSlotRecord & { taken: bigint })[]>`
    SELECT s.*, COALESCE(bc.taken, 0) AS "taken"
    FROM "BookingSlot" s
    LEFT JOIN (
      SELECT "slotId", COUNT(*) AS taken FROM "Booking" WHERE status IN ('PENDING', 'CONFIRMED') GROUP BY "slotId"
    ) bc ON bc."slotId" = s.id
    WHERE s."eventId" = ${eventId} AND s."date" >= ${date} AND s."date" < ${nextDay}
    ORDER BY s."startTime" ASC
  `;
  return rows.map(withAvailability);
}

/** Per-day total/available slot counts for one month of an event — the
 *  public calendar's at-a-glance "open / few left / full" coloring, same
 *  idea as the old GET /api/public/bookings/availability but computed
 *  directly in SQL rather than pulled row-by-row into JS. */
export async function monthlyAvailabilityForEvent(
  eventId: string,
  firstOfMonth: Date,
  firstOfNextMonth: Date
): Promise<Record<string, { total: number; available: number }>> {
  const rows = await prisma.$queryRaw<{ date: Date; total: bigint; available: bigint }[]>`
    SELECT s."date" AS date,
           SUM(s.quota)::int AS total,
           SUM(GREATEST(s.quota - COALESCE(bc.taken, 0), 0))::int AS available
    FROM "BookingSlot" s
    LEFT JOIN (
      SELECT "slotId", COUNT(*) AS taken FROM "Booking" WHERE status IN ('PENDING', 'CONFIRMED') GROUP BY "slotId"
    ) bc ON bc."slotId" = s.id
    WHERE s."eventId" = ${eventId} AND s."date" >= ${firstOfMonth} AND s."date" < ${firstOfNextMonth}
    GROUP BY s."date"
    ORDER BY s."date" ASC
  `;
  const out: Record<string, { total: number; available: number }> = {};
  for (const row of rows) {
    out[dateKey(row.date)] = { total: Number(row.total), available: Number(row.available) };
  }
  return out;
}

export async function getSlot(id: string): Promise<BookingSlotRecord | null> {
  const rows = await prisma.$queryRaw<BookingSlotRecord[]>`
    SELECT * FROM "BookingSlot" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

/** How many non-cancelled/non-rejected bookings currently hold this slot. */
export async function countActiveBookingsForSlot(slotId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "Booking" WHERE "slotId" = ${slotId} AND status IN ('PENDING', 'CONFIRMED')
  `;
  return Number(rows[0]?.count || 0);
}

/** How many non-cancelled/non-rejected bookings exist anywhere under this
 *  event — used to gate whether the whole event can be deleted. */
export async function countActiveBookingsForEvent(eventId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "Booking" b
    JOIN "BookingSlot" s ON b."slotId" = s.id
    WHERE s."eventId" = ${eventId} AND b.status IN ('PENDING', 'CONFIRMED')
  `;
  return Number(rows[0]?.count || 0);
}

/** How many bookings (any status) reference this slot — used to decide
 *  whether deleting the slot would silently discard booking history. */
export async function countAnyBookingsForSlot(slotId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "Booking" WHERE "slotId" = ${slotId}
  `;
  return Number(rows[0]?.count || 0);
}

export type SlotFields = {
  date: Date | null;
  startTime: string;
  durationMins: number;
  quota: number;
  error: string | null;
};

/** Validates a single-slot creation submission against its parent event's
 *  date range. */
export function slotFieldsFrom(body: any, event: BookingEventRecord): SlotFields {
  const fail = (error: string): SlotFields => ({
    date: null,
    startTime: "",
    durationMins: DEFAULT_SLOT_DURATION_MINUTES,
    quota: 1,
    error,
  });

  const date = parseDateOnly(body.date);
  if (!date) return fail("Please pick a valid date.");
  if (date.getTime() < event.startDate.getTime() || date.getTime() > event.endDate.getTime()) {
    return fail("That date is outside this event's date range.");
  }

  if (!isValidTimeString(body.startTime)) return fail("Please pick a valid start time.");
  const startTime = body.startTime;

  const durationRaw = Number(body.durationMins);
  if (!Number.isFinite(durationRaw)) return fail("Please set a duration.");
  const durationMins = Math.min(
    SLOT_DURATION_MAX_MINUTES,
    Math.max(SLOT_DURATION_MIN_MINUTES, Math.round(durationRaw))
  );

  const quotaRaw = Number(body.quota);
  if (!Number.isInteger(quotaRaw) || quotaRaw < 1) return fail("Quota must be at least 1.");
  const quota = Math.min(MAX_SLOT_QUOTA, quotaRaw);

  return { date, startTime, durationMins, quota, error: null };
}

export type BulkSlotFields = {
  date: Date | null;
  startTime: string;
  endTime: string;
  durationMins: number;
  quota: number;
  error: string | null;
};

/** Validates a "generate back-to-back slots for this day" submission — a
 *  shift window (startTime..endTime) filled with consecutive slots of the
 *  given duration. */
export function bulkSlotFieldsFrom(body: any, event: BookingEventRecord): BulkSlotFields {
  const fail = (error: string): BulkSlotFields => ({
    date: null,
    startTime: "",
    endTime: "",
    durationMins: DEFAULT_SLOT_DURATION_MINUTES,
    quota: 1,
    error,
  });

  const date = parseDateOnly(body.date);
  if (!date) return fail("Please pick a valid date.");
  if (date.getTime() < event.startDate.getTime() || date.getTime() > event.endDate.getTime()) {
    return fail("That date is outside this event's date range.");
  }

  if (!isValidTimeString(body.startTime)) return fail("Please pick a valid shift start time.");
  if (!isValidTimeString(body.endTime)) return fail("Please pick a valid shift end time.");
  const startTime = body.startTime;
  const endTime = body.endTime;
  if (minutesOf(endTime) <= minutesOf(startTime)) {
    return fail("The shift end time must be after its start time.");
  }

  const durationRaw = Number(body.durationMins);
  if (!Number.isFinite(durationRaw)) return fail("Please set a duration.");
  const durationMins = Math.min(
    SLOT_DURATION_MAX_MINUTES,
    Math.max(SLOT_DURATION_MIN_MINUTES, Math.round(durationRaw))
  );
  if (durationMins > minutesOf(endTime) - minutesOf(startTime)) {
    return fail("The slot duration doesn't fit within the shift window.");
  }

  const quotaRaw = Number(body.quota);
  if (!Number.isInteger(quotaRaw) || quotaRaw < 1) return fail("Quota must be at least 1.");
  const quota = Math.min(MAX_SLOT_QUOTA, quotaRaw);

  return { date, startTime, endTime, durationMins, quota, error: null };
}

export async function createSlot(
  eventId: string,
  fields: { date: Date; startTime: string; durationMins: number; quota: number }
): Promise<BookingSlotRecord> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<BookingSlotRecord[]>`
    INSERT INTO "BookingSlot" ("id", "eventId", "date", "startTime", "durationMins", "quota", "createdAt")
    VALUES (${id}, ${eventId}, ${fields.date}, ${fields.startTime}, ${fields.durationMins}, ${fields.quota}, now())
    RETURNING *
  `;
  return rows[0];
}

/** Fills a shift window with consecutive, non-overlapping slots of a fixed
 *  duration — e.g. a 9:00–17:00 window at 90 minutes each produces slots at
 *  9:00, 10:30, 12:00, 13:30, 15:00 (a trailing partial slot that wouldn't
 *  fit is simply dropped). Always produces at least one slot — bulkSlotFieldsFrom
 *  already rejects a window too short for even one. */
export async function createSlotsBulk(
  eventId: string,
  fields: { date: Date; startTime: string; endTime: string; durationMins: number; quota: number }
): Promise<BookingSlotRecord[]> {
  const created: BookingSlotRecord[] = [];
  let cursor = minutesOf(fields.startTime);
  const end = minutesOf(fields.endTime);
  while (cursor + fields.durationMins <= end) {
    const startTime = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
    created.push(
      await createSlot(eventId, { date: fields.date, startTime, durationMins: fields.durationMins, quota: fields.quota })
    );
    cursor += fields.durationMins;
  }
  return created;
}

/** Callers must check countAnyBookingsForSlot first — this does not re-check. */
export async function deleteSlot(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "BookingSlot" WHERE "id" = ${id}`;
}

/** Updates the columns a slot already has. Callers must refuse a quota below the number of active bookings. */
export async function updateSlot(
  id: string,
  fields: { date: Date; startTime: string; durationMins: number; quota: number }
): Promise<BookingSlotRecord | null> {
  const rows = await prisma.$queryRaw<BookingSlotRecord[]>`
    UPDATE "BookingSlot"
    SET "date" = ${fields.date}, "startTime" = ${fields.startTime}, "durationMins" = ${fields.durationMins}, "quota" = ${fields.quota}
    WHERE "id" = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

/** Copies the first day's times from another event (or this one) onto a date. Skips a time that is already on that date. */
export async function copyFirstDaySlots(
  targetEventId: string,
  sourceEventId: string,
  date: Date
): Promise<BookingSlotRecord[]> {
  const sourceSlots = await listSlotsForEvent(sourceEventId);
  if (sourceSlots.length === 0) return [];
  const firstDay = dateKey(sourceSlots[0].date);
  const daySlots = sourceSlots.filter((slot) => dateKey(slot.date) === firstDay);
  const existing = await listSlotsForEventOnDate(targetEventId, date);
  const created: BookingSlotRecord[] = [];
  for (const slot of daySlots) {
    if (existing.some((row) => row.startTime === slot.startTime && row.durationMins === slot.durationMins)) continue;
    created.push(
      await createSlot(targetEventId, {
        date,
        startTime: slot.startTime,
        durationMins: slot.durationMins,
        quota: slot.quota,
      })
    );
  }
  return created;
}

// -----------------------------------------------------------------------------
// Booking
// -----------------------------------------------------------------------------

export type BookingRecord = {
  id: string;
  slotId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string;
  status: BookingStatus;
  submittedIp: string | null;
  decidedAt: Date | null;
  decidedNote: string | null;
  cancelToken: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BookingWithSlot = BookingRecord & {
  slotDate: Date;
  slotStartTime: string;
  slotDurationMins: number;
  slotQuota: number;
};

/** Every booking under one event, joined with its slot's date/time — the
 *  admin event detail page's confirmed/cancelled lists. */
export async function listBookingsForEvent(eventId: string): Promise<BookingWithSlot[]> {
  return prisma.$queryRaw<BookingWithSlot[]>`
    SELECT b.*, s."date" AS "slotDate", s."startTime" AS "slotStartTime",
           s."durationMins" AS "slotDurationMins", s."quota" AS "slotQuota"
    FROM "Booking" b
    JOIN "BookingSlot" s ON b."slotId" = s.id
    WHERE s."eventId" = ${eventId}
    ORDER BY s."date" ASC, s."startTime" ASC
  `;
}

export async function getBooking(id: string): Promise<BookingRecord | null> {
  const rows = await prisma.$queryRaw<BookingRecord[]>`
    SELECT * FROM "Booking" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

/** A booking plus its slot and parent event — everything the staff/client
 *  cancel routes need for their email + activity description. */
export async function getBookingWithSlotAndEvent(
  id: string
): Promise<(BookingWithSlot & { eventId: string; eventName: string; eventCompanyName: string }) | null> {
  const rows = await prisma.$queryRaw<
    (BookingWithSlot & { eventId: string; eventName: string; eventCompanyName: string })[]
  >`
    SELECT b.*, s."date" AS "slotDate", s."startTime" AS "slotStartTime",
           s."durationMins" AS "slotDurationMins", s."quota" AS "slotQuota",
           e."id" AS "eventId", e."name" AS "eventName", e."companyName" AS "eventCompanyName"
    FROM "Booking" b
    JOIN "BookingSlot" s ON b."slotId" = s.id
    JOIN "BookingEvent" e ON s."eventId" = e.id
    WHERE b."id" = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

/** Same as getBookingWithSlotAndEvent, but looked up by the client's own
 *  cancelToken instead of the booking id — the public
 *  src/app/booking-cancel/[token]/page.tsx's only entry point. */
export async function getBookingByCancelToken(
  cancelToken: string
): Promise<(BookingWithSlot & { eventId: string; eventName: string; eventCompanyName: string }) | null> {
  const rows = await prisma.$queryRaw<
    (BookingWithSlot & { eventId: string; eventName: string; eventCompanyName: string })[]
  >`
    SELECT b.*, s."date" AS "slotDate", s."startTime" AS "slotStartTime",
           s."durationMins" AS "slotDurationMins", s."quota" AS "slotQuota",
           e."id" AS "eventId", e."name" AS "eventName", e."companyName" AS "eventCompanyName"
    FROM "Booking" b
    JOIN "BookingSlot" s ON b."slotId" = s.id
    JOIN "BookingEvent" e ON s."eventId" = e.id
    WHERE b."cancelToken" = ${cancelToken}
    LIMIT 1
  `;
  return rows[0] || null;
}

export type BookingFields = {
  clientName: string;
  clientPhone: string | null;
  clientEmail: string;
  notes: string;
  error: string | null;
};

/** Validates a public booking submission's client-info fields — slot
 *  selection/availability is checked separately by the route, right before
 *  insert, since that's a race against whatever else might be in flight.
 *  No company field here — every booking belongs to its event's own
 *  companyName (see BookingEvent), so clients are never asked for one. */
export function bookingFieldsFrom(body: any): BookingFields {
  const fail = (error: string): BookingFields => ({
    clientName: "",
    clientPhone: null,
    clientEmail: "",
    notes: "",
    error,
  });

  const clientName = (body.clientName || "").trim();
  if (!clientName) return fail("Please enter your name.");

  const clientPhone = (body.clientPhone || "").trim() || null;

  const clientEmail = (body.clientEmail || "").trim();
  if (!clientEmail) return fail("Please provide an email address so we can confirm your booking.");
  if (!isValidEmail(clientEmail)) return fail("That email address doesn't look valid.");

  const notes = (body.notes || "").trim();

  return { clientName, clientPhone, clientEmail, notes, error: null };
}

/** Creates a booking, either immediately CONFIRMED (the default) or PENDING
 *  staff review, per the parent event's own `requiresConfirmation` flag —
 *  see the schema comment on that column. Generates this booking's own
 *  cancelToken either way, since a client can cancel a still-pending
 *  request the same way as a confirmed one. */
export async function createBooking(
  slotId: string,
  fields: BookingFields,
  submittedIp: string | null,
  requiresConfirmation: boolean
): Promise<BookingRecord> {
  const id = randomUUID();
  const cancelToken = generateSigningToken();
  const status: BookingStatus = requiresConfirmation ? "PENDING" : "CONFIRMED";
  const rows = await prisma.$queryRaw<BookingRecord[]>`
    INSERT INTO "Booking"
      ("id", "slotId", "clientName", "clientPhone", "clientEmail", "notes", "status", "submittedIp", "cancelToken", "createdAt", "updatedAt")
    VALUES
      (${id}, ${slotId}, ${fields.clientName}, ${fields.clientPhone}, ${fields.clientEmail}, ${fields.notes}, ${status}, ${submittedIp}, ${cancelToken}, now(), now())
    RETURNING *
  `;
  return rows[0];
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  decidedNote: string | null
): Promise<BookingRecord | null> {
  const rows = await prisma.$queryRaw<BookingRecord[]>`
    UPDATE "Booking"
    SET "status" = ${status}, "decidedAt" = now(), "decidedNote" = ${decidedNote}, "updatedAt" = now()
    WHERE "id" = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function deleteBooking(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "Booking" WHERE "id" = ${id}`;
}

/** Points an existing booking at another slot. Both rows already exist; only slotId changes. */
export async function moveBookingToSlot(bookingId: string, slotId: string): Promise<BookingRecord | null> {
  const rows = await prisma.$queryRaw<BookingRecord[]>`
    UPDATE "Booking" SET "slotId" = ${slotId}, "updatedAt" = now() WHERE "id" = ${bookingId} RETURNING *
  `;
  return rows[0] || null;
}
