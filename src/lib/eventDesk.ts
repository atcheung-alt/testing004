import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateSigningToken } from "@/lib/signing";
import { getCurrentUser } from "@/lib/auth";

export const DESK_SLOT_CAP = 200;

export type DeskQuestion = { label: string; required: boolean };

export function parseDeskQuestions(value: string): DeskQuestion[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "string") return { label: item.trim(), required: false };
        if (item && typeof item === "object" && typeof item.label === "string") {
          return { label: item.label.trim(), required: Boolean(item.required) };
        }
        return null;
      })
      .filter((item): item is DeskQuestion => Boolean(item?.label))
      .slice(0, 8);
  } catch {
    return [];
  }
}
export const DEFAULT_DESK_SLOTS = ["09:30 – 10:30", "10:30 – 11:30", "14:00 – 15:00", "15:00 – 16:00"];

export async function ensureDeskTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DeskEvent" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL DEFAULT '',
      "eventDate" TEXT NOT NULL DEFAULT '',
      "slotCap" INTEGER NOT NULL DEFAULT 1,
      "questions" TEXT NOT NULL DEFAULT '[]',
      "slots" TEXT NOT NULL DEFAULT '[]',
      "joinToken" TEXT NOT NULL,
      "hostToken" TEXT NOT NULL,
      "doorToken" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DeskEvent_joinToken_key" ON "DeskEvent"("joinToken")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DeskEvent_hostToken_key" ON "DeskEvent"("hostToken")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DeskEvent_doorToken_key" ON "DeskEvent"("doorToken")`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DeskEvent" ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DeskEvent" ADD COLUMN IF NOT EXISTS "slotCap" INTEGER NOT NULL DEFAULT 1`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DeskEvent" ADD COLUMN IF NOT EXISTS "confirmFrom" TEXT NOT NULL DEFAULT 'contact@hrplus.info'`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DeskBooking" (
      "id" TEXT PRIMARY KEY,
      "eventId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "answers" TEXT NOT NULL DEFAULT '{}',
      "slot" TEXT NOT NULL,
      "arrived" BOOLEAN NOT NULL DEFAULT false,
      "arrivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DeskBooking_eventId_createdAt_idx" ON "DeskBooking"("eventId", "createdAt")`);
}

export function deskBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function parseAnswers(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === "string") out[key] = item;
    }
    return out;
  } catch {
    return {};
  }
}

export async function requireDeskUser() {
  const user = await getCurrentUser();
  if (!user || user.email.trim().toLowerCase() !== "atcheung@hrplus.info") return null;
  return user;
}

async function nextEventCode(): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `EV-${year}-`;
  const rows = await prisma.deskEvent.findMany({
    where: { code: { startsWith: pattern } },
    select: { code: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const seq = parseInt(row.code.slice(pattern.length), 10);
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${pattern}${String(maxSeq + 1).padStart(4, "0")}`;
}

async function fillMissingEventCodes(): Promise<void> {
  const missing = await prisma.deskEvent.findMany({ where: { code: "" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  for (const row of missing) {
    await prisma.deskEvent.update({ where: { id: row.id }, data: { code: await nextEventCode() } });
  }
}

export async function listDeskEvents() {
  await ensureDeskTables();
  await fillMissingEventCodes();
  const rows = await prisma.deskEvent.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bookings: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    eventDate: row.eventDate,
    booked: row._count.bookings,
  }));
}

export async function loadDeskEvent(id: string) {
  await ensureDeskTables();
  await fillMissingEventCodes();
  const row = await prisma.deskEvent.findUnique({
    where: { id },
    include: { bookings: { orderBy: { createdAt: "desc" } } },
  });
  if (!row) return null;
  return present(row);
}

function present(row: {
  id: string;
  name: string;
  code: string;
  eventDate: string;
  slotCap: number;
  questions: string;
  slots: string;
  joinToken: string;
  hostToken: string;
  doorToken: string;
  confirmFrom?: string;
  bookings: { id: string; name: string; email: string; answers: string; slot: string; arrived: boolean }[];
}) {
  const base = deskBaseUrl();
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    eventDate: row.eventDate,
    slotCap: row.slotCap || 1,
    questions: parseDeskQuestions(row.questions),
    slots: parseStringList(row.slots),
    joinUrl: `${base}/join/${row.joinToken}`,
    hostUrl: `${base}/host/${row.hostToken}`,
    doorUrl: `${base}/door/${row.doorToken}`,
    confirmFrom: row.confirmFrom || "contact@hrplus.info",
    bookings: row.bookings.map((booking) => ({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      answers: parseAnswers(booking.answers),
      slot: booking.slot,
      arrived: booking.arrived,
    })),
  };
}

function cleanList(items: string[] | undefined, fallback: string[], max: number, length: number) {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return JSON.stringify(source.map((item) => item.trim().slice(0, length)).filter(Boolean).slice(0, max));
}

export async function createDeskEvent(name: string, eventDate: string, questions?: DeskQuestion[], slots?: string[], slotCap = 1) {
  await ensureDeskTables();
  const row = await prisma.deskEvent.create({
    data: {
      name: name.slice(0, 120),
      code: await nextEventCode(),
      eventDate: eventDate.slice(0, 40),
      slotCap: Math.min(500, Math.max(1, Math.round(slotCap) || 1)),
      questions: JSON.stringify(parseDeskQuestions(JSON.stringify(questions || []))),
      slots: cleanList(slots, [], 96, 40),
      joinToken: generateSigningToken(),
      hostToken: generateSigningToken(),
      doorToken: generateSigningToken(),
    },
    include: { bookings: true },
  });
  return present(row);
}

export async function updateDeskEvent(id: string, input: { name?: string; eventDate?: string; questions?: DeskQuestion[]; slots?: string[]; slotCap?: number; confirmFrom?: string }) {
  await ensureDeskTables();
  const data: { name?: string; eventDate?: string; questions?: string; slots?: string; slotCap?: number; confirmFrom?: string } = {};
  if (typeof input.name === "string") data.name = input.name.trim().slice(0, 120);
  if (typeof input.eventDate === "string") data.eventDate = input.eventDate.trim().slice(0, 40);
  if (Array.isArray(input.questions)) data.questions = JSON.stringify(parseDeskQuestions(JSON.stringify(input.questions)));
  if (Array.isArray(input.slots)) data.slots = JSON.stringify(input.slots.map((item) => item.trim().slice(0, 40)).filter(Boolean).slice(0, 96));
  if (typeof input.slotCap === "number") data.slotCap = Math.min(500, Math.max(1, Math.round(input.slotCap) || 1));
  if (typeof input.confirmFrom === "string" && input.confirmFrom.includes("@")) data.confirmFrom = input.confirmFrom.trim().slice(0, 160);
  const row = await prisma.deskEvent.update({
    where: { id },
    data,
    include: { bookings: { orderBy: { createdAt: "desc" } } },
  });
  return present(row);
}
