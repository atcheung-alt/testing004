import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// -----------------------------------------------------------------------------
// The Event model (see prisma/schema.prisma) — a calendar entry created
// explicitly by staff via "Mark on calendar" on an invoice, once its event
// start/end date are both set. Read/written here with $queryRaw/$executeRaw
// rather than a generated `prisma.event.*` delegate, because this file was
// written before `npx prisma generate` had been re-run against the new
// model — run that (needed anyway to pick up the schema change) and this
// could switch to the typed delegate; the raw SQL below works correctly
// against the real "Event" table either way, so there's no rush.
// -----------------------------------------------------------------------------

export type EventRecord = {
  id: string;
  companyId: string | null;
  invoiceId: string;
  name: string;
  startDate: Date;
  startTime: string | null;
  endDate: Date;
  endTime: string | null;
  durationMins: number;
  contactPerson: string | null;
  companyName: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Combine a date with an optional "HH:mm" time into one instant, defaulting
 *  to midnight when no time is given. */
function combineDateTime(date: Date, time: string | null): Date {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (!time) return base;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return base;
  base.setHours(h, m);
  return base;
}

/** Minutes between (startDate+startTime) and (endDate+endTime) — floored at
 *  0 for a same-instant or (shouldn't happen, given eventFieldsFrom's own
 *  "end >= start" validation) inverted range. */
export function computeDurationMins(
  startDate: Date,
  startTime: string | null,
  endDate: Date,
  endTime: string | null
): number {
  const start = combineDateTime(startDate, startTime);
  const end = combineDateTime(endDate, endTime);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** This invoice's calendar event, or null if "Mark on calendar" hasn't been
 *  clicked for it yet (Event.invoiceId is unique — at most one per invoice). */
export async function getEventForInvoice(invoiceId: string): Promise<EventRecord | null> {
  const rows = await prisma.$queryRaw<EventRecord[]>`
    SELECT * FROM "Event" WHERE "invoiceId" = ${invoiceId} LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Create this invoice's calendar event — the "Mark on calendar" action.
 * Caller (the API route) is responsible for having already checked that the
 * invoice has both an event start and end date, and that it doesn't already
 * have an event (the unique index on invoiceId would otherwise reject this
 * with a constraint violation).
 */
export async function createEventForInvoice(params: {
  invoiceId: string;
  name: string;
  startDate: Date;
  startTime: string | null;
  endDate: Date;
  endTime: string | null;
  contactPerson: string | null;
  companyName: string;
  companyId?: string | null;
}): Promise<EventRecord> {
  const id = randomUUID();
  const durationMins = computeDurationMins(params.startDate, params.startTime, params.endDate, params.endTime);
  const rows = await prisma.$queryRaw<EventRecord[]>`
    INSERT INTO "Event"
      ("id", "invoiceId", "companyId", "name", "startDate", "startTime", "endDate", "endTime", "durationMins", "contactPerson", "companyName", "createdAt", "updatedAt")
    VALUES
      (${id}, ${params.invoiceId}, ${params.companyId || null}, ${params.name}, ${params.startDate}, ${params.startTime}, ${params.endDate}, ${params.endTime}, ${durationMins}, ${params.contactPerson}, ${params.companyName}, now(), now())
    RETURNING *
  `;
  return rows[0];
}

/** Every calendar event, oldest start date first — the Calendar page's only
 *  data source (see src/app/(app)/calendar/page.tsx). Unlike the old
 *  quotation-based calendar, there's no status to filter on; every row here
 *  is on the calendar because staff explicitly put it there. */
export async function listEvents(): Promise<EventRecord[]> {
  return prisma.$queryRaw<EventRecord[]>`
    SELECT * FROM "Event" ORDER BY "startDate" ASC
  `;
}
