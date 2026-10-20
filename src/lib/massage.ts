import crypto from "crypto";
import { headers } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBookingEvent, listBookingEvents } from "@/lib/bookings";
import { generateSigningToken } from "@/lib/signing";

// Customer-facing names from the company's roster. The spreadsheet's star
// notes (4星, 4.5星, …) are left off on purpose: printing an old rating
// next to the name would steer the guest's score.
export const MASSAGE_THERAPISTS: { id: string; name: string }[] = [
  { id: "mt_mani", name: "Mani Man Yi Sin" },
  { id: "mt_jenny_wang", name: "Jenny Wang（汪師傅）" },
  { id: "mt_kelly_wu", name: "Kelly Wu" },
  { id: "mt_yeung", name: "楊師傅" },
  { id: "mt_kiu_yu", name: "Kiu Yu" },
  { id: "mt_lena_lau", name: "Lena Lau" },
  { id: "mt_eva", name: "Eva" },
  { id: "mt_lai_lai", name: "麗麗" },
  { id: "mt_ah_mui", name: "阿梅" },
  { id: "mt_amy", name: "Amy 思琪" },
  { id: "mt_jenny_liu", name: "Jenny Liu" },
  { id: "mt_juby", name: "Juby Chung" },
  { id: "mt_jolly", name: "Jolly Lau" },
  { id: "mt_to_lai_sa", name: "杜麗莎" },
  { id: "mt_chiu_chan", name: "Chiu Chan" },
  { id: "mt_susan", name: "Susan" },
  { id: "mt_wong", name: "黃師傅" },
  { id: "mt_yona", name: "Yona" },
  { id: "mt_yancy", name: "Yancy" },
  { id: "mt_brain", name: "Brain" },
];

// Below this many surveys the result is still shown, with an In progress mark.
export const EARLY_SURVEY_COUNT = 8;

// Points held back from a single survey. The hold-back shrinks with the
// square root of the sample, so 5.0 from 1 guest (4.0) stays under 4.8 from
// 100 guests (4.7).
export const SAMPLE_CAUTION = 1;

export function adjustedScore(raw: number, count: number): number {
  if (count <= 0) return 0;
  const cautious = raw - SAMPLE_CAUTION / Math.sqrt(count);
  return Math.min(5, Math.max(1, cautious));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function surveyScore(parts: {
  overall: number;
  focus: number;
  pressure: number;
  relief: number;
}): number {
  return round1((parts.overall + parts.focus + parts.pressure + parts.relief) / 4);
}

export type TherapistStanding = {
  id: string;
  name: string;
  count: number;
  score: number;
  adjusted: number;
  overall: number;
  focus: number;
  pressure: number;
  relief: number;
  early: boolean;
};

type AvgRow = {
  therapistId: string;
  _count: { _all: number };
  _avg: { overall: number | null; focus: number | null; pressure: number | null; relief: number | null };
};

function standingFrom(therapist: { id: string; name: string }, row: AvgRow | undefined): TherapistStanding {
  const count = row?._count._all ?? 0;
  const overall = row?._avg.overall ?? 0;
  const focus = row?._avg.focus ?? 0;
  const pressure = row?._avg.pressure ?? 0;
  const relief = row?._avg.relief ?? 0;
  const score = count ? surveyScore({ overall, focus, pressure, relief }) : 0;
  return {
    id: therapist.id,
    name: therapist.name,
    count,
    score,
    adjusted: count ? adjustedScore(score, count) : 0,
    overall: count ? round1(overall) : 0,
    focus: count ? round1(focus) : 0,
    pressure: count ? round1(pressure) : 0,
    relief: count ? round1(relief) : 0,
    early: count > 0 && count < EARLY_SURVEY_COUNT,
  };
}

// The survey tables are new and empty. Creating them does not add or rename
// columns on Invoice or any older table. This runs only when the tables are
// missing, the same way the access-group table is created.
let massageTablesReady: Promise<boolean> | null = null;

async function createMassageTables(): Promise<boolean> {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) return false;
  const direct = new PrismaClient({ datasources: { db: { url: connectionString } } });
  const statements = [
    `CREATE TABLE IF NOT EXISTS "MassageTherapist" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MassageTherapist_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "MassageEventLink" (
      "id" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "bookingEventId" TEXT,
      "invoiceId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MassageEventLink_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "MassageSurvey" (
      "id" TEXT NOT NULL,
      "linkId" TEXT NOT NULL,
      "invoiceId" TEXT,
      "therapistId" TEXT NOT NULL,
      "overall" INTEGER NOT NULL,
      "focus" INTEGER NOT NULL,
      "pressure" INTEGER NOT NULL,
      "relief" INTEGER NOT NULL,
      "comment" TEXT NOT NULL DEFAULT '',
      "language" TEXT NOT NULL DEFAULT 'zh',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MassageSurvey_pkey" PRIMARY KEY ("id")
    )`,
    // Older databases keyed the QR code by invoice. Move that key aside so a
    // booking event can own the code before any invoice exists.
    `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MassageEventLink' AND column_name = 'invoiceId'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MassageEventLink' AND column_name = 'id'
      ) THEN
        ALTER TABLE "MassageEventLink" ADD COLUMN "id" TEXT;
        ALTER TABLE "MassageEventLink" ADD COLUMN "bookingEventId" TEXT;
        UPDATE "MassageEventLink" SET "id" = "invoiceId" WHERE "id" IS NULL;
        ALTER TABLE "MassageEventLink" DROP CONSTRAINT "MassageEventLink_pkey";
        ALTER TABLE "MassageEventLink" ALTER COLUMN "id" SET NOT NULL;
        ALTER TABLE "MassageEventLink" ADD CONSTRAINT "MassageEventLink_pkey" PRIMARY KEY ("id");
        ALTER TABLE "MassageEventLink" ALTER COLUMN "invoiceId" DROP NOT NULL;
      END IF;
    END $$`,
    `ALTER TABLE "MassageEventLink" ADD COLUMN IF NOT EXISTS "bookingEventId" TEXT`,
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MassageSurvey' AND column_name = 'linkId'
      ) THEN
        ALTER TABLE "MassageSurvey" ADD COLUMN "linkId" TEXT;
      END IF;
    END $$`,
    `UPDATE "MassageSurvey" AS survey
      SET "linkId" = link."id"
      FROM "MassageEventLink" AS link
      WHERE survey."linkId" IS NULL
        AND survey."invoiceId" IS NOT NULL
        AND survey."invoiceId" = link."invoiceId"`,
    `ALTER TABLE "MassageSurvey" ALTER COLUMN "invoiceId" DROP NOT NULL`,
    `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM "MassageSurvey" WHERE "linkId" IS NULL) THEN
        ALTER TABLE "MassageSurvey" ALTER COLUMN "linkId" SET NOT NULL;
      END IF;
    END $$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MassageEventLink_token_key" ON "MassageEventLink"("token")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MassageEventLink_invoiceId_key" ON "MassageEventLink"("invoiceId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MassageEventLink_bookingEventId_key" ON "MassageEventLink"("bookingEventId")`,
    `CREATE INDEX IF NOT EXISTS "MassageSurvey_linkId_createdAt_idx" ON "MassageSurvey"("linkId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "MassageSurvey_invoiceId_createdAt_idx" ON "MassageSurvey"("invoiceId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "MassageSurvey_therapistId_idx" ON "MassageSurvey"("therapistId")`,
    `DO $$
    DECLARE deltype "char";
    BEGIN
      SELECT c.confdeltype INTO deltype FROM pg_constraint c
      WHERE c.conname = 'MassageEventLink_invoiceId_fkey';
      IF deltype IS NULL THEN
        ALTER TABLE "MassageEventLink"
          ADD CONSTRAINT "MassageEventLink_invoiceId_fkey"
          FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      ELSIF deltype = 'c' THEN
        ALTER TABLE "MassageEventLink" DROP CONSTRAINT "MassageEventLink_invoiceId_fkey";
        ALTER TABLE "MassageEventLink"
          ADD CONSTRAINT "MassageEventLink_invoiceId_fkey"
          FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "MassageEventLink"
        ADD CONSTRAINT "MassageEventLink_bookingEventId_fkey"
        FOREIGN KEY ("bookingEventId") REFERENCES "BookingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$
    DECLARE deltype "char";
    BEGIN
      SELECT c.confdeltype INTO deltype FROM pg_constraint c
      WHERE c.conname = 'MassageSurvey_invoiceId_fkey';
      IF deltype IS NULL THEN
        ALTER TABLE "MassageSurvey"
          ADD CONSTRAINT "MassageSurvey_invoiceId_fkey"
          FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      ELSIF deltype = 'c' THEN
        ALTER TABLE "MassageSurvey" DROP CONSTRAINT "MassageSurvey_invoiceId_fkey";
        ALTER TABLE "MassageSurvey"
          ADD CONSTRAINT "MassageSurvey_invoiceId_fkey"
          FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
    `DO $$ BEGIN
      ALTER TABLE "MassageSurvey"
        ADD CONSTRAINT "MassageSurvey_linkId_fkey"
        FOREIGN KEY ("linkId") REFERENCES "MassageEventLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "MassageSurvey"
        ADD CONSTRAINT "MassageSurvey_therapistId_fkey"
        FOREIGN KEY ("therapistId") REFERENCES "MassageTherapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];
  try {
    for (const statement of statements) {
      await direct.$executeRawUnsafe(statement);
    }
    return true;
  } catch (err) {
    console.error("ensureMassageTables failed:", err);
    return false;
  } finally {
    await direct.$disconnect().catch(() => undefined);
  }
}

export function ensureMassageTables(): Promise<boolean> {
  if (!massageTablesReady) {
    massageTablesReady = createMassageTables().then((ok) => {
      if (!ok) massageTablesReady = null;
      return ok;
    });
  }
  return massageTablesReady;
}

function missingMassageTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2021";
}

// Seed the company roster once. Existing rows are left alone, so a therapist
// who was removed (active = false) is not put back, and a renamed row is not
// overwritten. No columns are added.
export async function ensureMassageTherapists(): Promise<void> {
  await ensureMassageTables();
  const existing = await prisma.massageTherapist.findMany({ select: { id: true } });
  const have = new Set(existing.map((row) => row.id));
  const missing = MASSAGE_THERAPISTS.flatMap((therapist, index) =>
    have.has(therapist.id) ? [] : [{ id: therapist.id, name: therapist.name, sortOrder: index, active: true }]
  );
  if (missing.length === 0) return;
  await prisma.massageTherapist.createMany({ data: missing, skipDuplicates: true });
}

export async function addMassageTherapist(name: string): Promise<{ id: string; name: string } | "empty" | "duplicate"> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return "empty";
  const duplicate = await prisma.massageTherapist.findFirst({
    where: { active: true, name: trimmed },
    select: { id: true },
  });
  if (duplicate) return "duplicate";
  // Putting the same name back uses the existing row, so earlier survey
  // scores stay with that therapist instead of starting a second record.
  const retired = await prisma.massageTherapist.findFirst({
    where: { active: false, name: trimmed },
    select: { id: true },
  });
  if (retired) {
    return prisma.massageTherapist.update({
      where: { id: retired.id },
      data: { active: true },
      select: { id: true, name: true },
    });
  }
  const last = await prisma.massageTherapist.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const id = `mt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  return prisma.massageTherapist.create({
    data: { id, name: trimmed, sortOrder: (last?.sortOrder ?? -1) + 1, active: true },
    select: { id: true, name: true },
  });
}

// Hides the name from new surveys and from the ranking. Past survey rows stay
// attached, so event history is unchanged.
export async function retireMassageTherapist(id: string): Promise<boolean> {
  const row = await prisma.massageTherapist.findUnique({ where: { id }, select: { id: true, active: true } });
  if (!row?.active) return false;
  await prisma.massageTherapist.update({ where: { id }, data: { active: false } });
  return true;
}

export type MassageSurveyPatch = {
  therapistId: string;
  overall: number;
  focus: number;
  pressure: number;
  relief: number;
  comment: string;
  guestNickname: string;
  timeSlot: string;
};

function scoreInRange(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export async function updateMassageSurvey(
  id: string,
  patch: MassageSurveyPatch
): Promise<"ok" | "missing" | "invalid"> {
  if (![patch.overall, patch.focus, patch.pressure, patch.relief].every(scoreInRange)) return "invalid";
  const [existing, therapist] = await Promise.all([
    prisma.massageSurvey.findUnique({ where: { id }, select: { id: true } }),
    prisma.massageTherapist.findUnique({ where: { id: patch.therapistId }, select: { id: true } }),
  ]);
  if (!existing) return "missing";
  if (!therapist) return "invalid";
  await prisma.massageSurvey.update({
    where: { id },
    data: {
      therapistId: patch.therapistId,
      overall: patch.overall,
      focus: patch.focus,
      pressure: patch.pressure,
      relief: patch.relief,
      comment: packSurveyNote(patch.guestNickname, patch.timeSlot, patch.comment),
    },
  });
  return "ok";
}

export async function deleteMassageSurvey(id: string): Promise<boolean> {
  const existing = await prisma.massageSurvey.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.massageSurvey.delete({ where: { id } });
  return true;
}

// Timeslot and nickname stay inside the existing comment text. The database
// columns do not change. Older comments have no marker and stay as written.
const SURVEY_NOTE = "@@ms1\n";

export function packSurveyNote(nickname: string, timeSlot: string, comment: string): string {
  const name = nickname.trim().slice(0, 80);
  const slot = timeSlot.trim().slice(0, 80);
  const text = comment.trim().slice(0, 500);
  if (!name && !slot) return text;
  return `${SURVEY_NOTE}${encodeURIComponent(name)}\n${encodeURIComponent(slot)}\n${text}`;
}

export function unpackSurveyNote(stored: string): { guestNickname: string; timeSlot: string; comment: string } {
  if (!stored.startsWith(SURVEY_NOTE)) return { guestNickname: "", timeSlot: "", comment: stored };
  const rest = stored.slice(SURVEY_NOTE.length);
  const first = rest.indexOf("\n");
  const second = first === -1 ? -1 : rest.indexOf("\n", first + 1);
  if (first === -1 || second === -1) return { guestNickname: "", timeSlot: "", comment: stored };
  try {
    return {
      guestNickname: decodeURIComponent(rest.slice(0, first)),
      timeSlot: decodeURIComponent(rest.slice(first + 1, second)),
      comment: rest.slice(second + 1),
    };
  } catch {
    return { guestNickname: "", timeSlot: "", comment: stored };
  }
}

export function mentionsMassage(value: string | null | undefined): boolean {
  if (!value) return false;
  return /massage/i.test(value) || value.includes("按摩");
}

export function massageSurveyUrlFromHeaders(token: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/massage-survey/${token}`;
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/massage-survey/${token}`;
}

const invoiceLabelSelect = {
  id: true,
  number: true,
  title: true,
  customerName: true,
} as const;

export type MassageInvoiceOption = {
  id: string;
  number: string;
  title: string;
  customerName: string;
};

export async function listMassageInvoiceOptions(): Promise<MassageInvoiceOption[]> {
  return prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 400,
    select: invoiceLabelSelect,
  });
}

export async function getMassageBookingLink(bookingEventId: string, create: boolean) {
  if (create) {
    const token = await ensureMassageLinkForBooking(bookingEventId);
    if (!token) return null;
  } else {
    await ensureMassageTables();
  }
  return prisma.massageEventLink.findUnique({
    where: { bookingEventId },
    select: { token: true, invoiceId: true },
  });
}

/** The guest QR belongs to the booking event. Creating it does not require an invoice. */
export async function ensureMassageLinkForBooking(bookingEventId: string): Promise<string | null> {
  await ensureMassageTables();
  const event = await getBookingEvent(bookingEventId);
  if (!event) return null;

  const existing = await prisma.massageEventLink.findUnique({
    where: { bookingEventId },
    select: { token: true },
  });
  if (existing) return existing.token;

  const token = generateSigningToken();
  try {
    const created = await prisma.massageEventLink.create({
      data: { bookingEventId, token },
      select: { token: true },
    });
    return created.token;
  } catch {
    const again = await prisma.massageEventLink.findUnique({
      where: { bookingEventId },
      select: { token: true },
    });
    return again?.token ?? null;
  }
}

export async function setMassageInvoice(bookingEventId: string, invoiceId: string | null): Promise<void> {
  await ensureMassageTables();
  const link = await prisma.massageEventLink.findUnique({
    where: { bookingEventId },
    select: { id: true },
  });
  if (!link) throw new Error("NO_LINK");

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
    if (!invoice) throw new Error("NO_INVOICE");
    const other = await prisma.massageEventLink.findUnique({
      where: { invoiceId },
      select: { id: true },
    });
    if (other && other.id !== link.id) throw new Error("ALREADY_LINKED");
  }

  await prisma.massageEventLink.update({
    where: { id: link.id },
    data: { invoiceId },
  });
  await prisma.massageSurvey.updateMany({
    where: { linkId: link.id },
    data: { invoiceId },
  });
}

export async function therapistStandings(linkId?: string): Promise<TherapistStanding[]> {
  await ensureMassageTherapists();
  try {
    const [therapists, grouped] = await Promise.all([
      prisma.massageTherapist.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.massageSurvey.groupBy({
        by: ["therapistId"],
        where: linkId ? { linkId } : undefined,
        _avg: { overall: true, focus: true, pressure: true, relief: true },
        _count: { _all: true },
      }),
    ]);
    const byId = new Map(grouped.map((row) => [row.therapistId, row]));
    return therapists
      .map((therapist) => standingFrom(therapist, byId.get(therapist.id)))
      .sort((a, b) => {
        if (a.count === 0 && b.count === 0) return a.name.localeCompare(b.name, "zh-HK");
        if (a.count === 0) return 1;
        if (b.count === 0) return -1;
        if (b.adjusted !== a.adjusted) return b.adjusted - a.adjusted;
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, "zh-HK");
      });
  } catch (err) {
    if (!missingMassageTable(err)) throw err;
    return [];
  }
}

export type MassageCalendarEvent = {
  id: string;
  bookingEventId: string | null;
  invoiceId: string | null;
  name: string;
  number: string | null;
  customerName: string;
  startDate: Date;
  endDate: Date;
  surveyCount: number;
  score: number;
};

type ScoreGroup = {
  _count: { _all: number };
  _avg: { overall: number | null; focus: number | null; pressure: number | null; relief: number | null };
};

function scoreFromGroup(row: ScoreGroup | undefined): { count: number; score: number } {
  const count = row?._count._all ?? 0;
  const score = count
    ? surveyScore({
        overall: row?._avg.overall ?? 0,
        focus: row?._avg.focus ?? 0,
        pressure: row?._avg.pressure ?? 0,
        relief: row?._avg.relief ?? 0,
      })
    : 0;
  return { count, score };
}

export async function listMassageBoard(): Promise<{ scheduled: MassageCalendarEvent[] }> {
  await ensureMassageTables();
  try {
    return await listMassageBoardRows();
  } catch (err) {
    if (!missingMassageTable(err)) throw err;
    console.error("Massage tables are still missing:", err);
    return { scheduled: [] };
  }
}

async function listMassageBoardRows(): Promise<{ scheduled: MassageCalendarEvent[] }> {
  const bookingEvents = await listBookingEvents();
  const massageDays = bookingEvents.filter(
    (event) => mentionsMassage(event.name) || mentionsMassage(event.description)
  );
  if (massageDays.length > 0) {
    const linked = await prisma.massageEventLink.findMany({
      where: { bookingEventId: { in: massageDays.map((event) => event.id) } },
      select: { bookingEventId: true },
    });
    const have = new Set(linked.map((row) => row.bookingEventId));
    await Promise.all(
      massageDays.filter((event) => !have.has(event.id)).map((event) => ensureMassageLinkForBooking(event.id))
    );
  }

  const [links, grouped] = await Promise.all([
    prisma.massageEventLink.findMany({
      include: { invoice: { select: invoiceLabelSelect } },
    }),
    prisma.massageSurvey.groupBy({
      by: ["linkId"],
      _avg: { overall: true, focus: true, pressure: true, relief: true },
      _count: { _all: true },
    }),
  ]);
  const byLink = new Map(grouped.map((row) => [row.linkId, row]));
  const bookingById = new Map(bookingEvents.map((event) => [event.id, event]));

  const legacyInvoiceIds = links.flatMap((link) =>
    !link.bookingEventId && link.invoiceId ? [link.invoiceId] : []
  );
  const legacyEvents =
    legacyInvoiceIds.length === 0
      ? []
      : await prisma.event.findMany({
          where: { invoiceId: { in: legacyInvoiceIds } },
          select: { id: true, invoiceId: true, name: true, startDate: true, endDate: true, companyName: true },
        });
  const legacyByInvoice = new Map(legacyEvents.map((event) => [event.invoiceId, event]));

  const scheduled: MassageCalendarEvent[] = [];

  for (const link of links) {
    const stats = scoreFromGroup(byLink.get(link.id));
    const booking = link.bookingEventId ? bookingById.get(link.bookingEventId) : undefined;
    if (booking) {
      const row: MassageCalendarEvent = {
        id: booking.id,
        bookingEventId: booking.id,
        invoiceId: link.invoiceId,
        name: booking.name,
        number: link.invoice?.number ?? null,
        customerName: booking.companyName,
        startDate: booking.startDate,
        endDate: booking.endDate,
        surveyCount: stats.count,
        score: stats.score,
      };
      scheduled.push(row);
      continue;
    }

    const legacy = link.invoiceId ? legacyByInvoice.get(link.invoiceId) : undefined;
    if (!legacy && !link.invoice) continue;
    scheduled.push({
      id: legacy?.id ?? link.id,
      bookingEventId: null,
      invoiceId: link.invoiceId,
      name: legacy?.name || link.invoice?.title || link.invoice?.customerName || "",
      number: link.invoice?.number ?? null,
      customerName: link.invoice?.customerName || legacy?.companyName || "",
      startDate: legacy?.startDate ?? link.createdAt,
      endDate: legacy?.endDate ?? link.createdAt,
      surveyCount: stats.count,
      score: stats.score,
    });
  }

  scheduled.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return { scheduled };
}

export type MassageEventView = {
  pageId: string;
  linkId: string;
  token: string;
  bookingEventId: string | null;
  name: string;
  companyName: string;
  startDate: Date;
  endDate: Date;
  invoice: MassageInvoiceOption | null;
};

export async function getMassageEventView(pageId: string): Promise<MassageEventView | null> {
  await ensureMassageTables();
  const booking = await getBookingEvent(pageId);
  if (booking && (mentionsMassage(booking.name) || mentionsMassage(booking.description))) {
    await ensureMassageLinkForBooking(booking.id);
  }

  const link = await findMassageLink(pageId);
  if (!link) return null;

  if (link.bookingEventId) {
    const event = booking?.id === link.bookingEventId ? booking : await getBookingEvent(link.bookingEventId);
    if (!event) return null;
    return {
      pageId: event.id,
      linkId: link.id,
      token: link.token,
      bookingEventId: event.id,
      name: event.name,
      companyName: event.companyName,
      startDate: event.startDate,
      endDate: event.endDate,
      invoice: link.invoice,
    };
  }

  const legacy = link.invoiceId
    ? await prisma.event.findUnique({
        where: { invoiceId: link.invoiceId },
        select: { id: true, name: true, companyName: true, startDate: true, endDate: true },
      })
    : null;
  return {
    pageId: legacy?.id ?? link.id,
    linkId: link.id,
    token: link.token,
    bookingEventId: null,
    name: legacy?.name || link.invoice?.title || link.invoice?.customerName || "",
    companyName: link.invoice?.customerName || legacy?.companyName || "",
    startDate: legacy?.startDate ?? link.createdAt,
    endDate: legacy?.endDate ?? link.createdAt,
    invoice: link.invoice,
  };
}

async function findMassageLink(pageId: string) {
  const include = { invoice: { select: invoiceLabelSelect } } as const;
  const byBooking = await prisma.massageEventLink.findUnique({
    where: { bookingEventId: pageId },
    include,
  });
  if (byBooking) return byBooking;

  const byId = await prisma.massageEventLink.findUnique({ where: { id: pageId }, include });
  if (byId) return byId;

  const calendar = await prisma.event.findUnique({
    where: { id: pageId },
    select: { invoiceId: true },
  });
  if (!calendar) return null;
  return prisma.massageEventLink.findUnique({
    where: { invoiceId: calendar.invoiceId },
    include,
  });
}
