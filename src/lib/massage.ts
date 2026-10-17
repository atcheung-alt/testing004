import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
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

const THERAPIST_IDS = new Set(MASSAGE_THERAPISTS.map((therapist) => therapist.id));

// Below this many surveys the rank is still shown, with an Early mark, the
// same way a review site shows a rating beside how many people wrote it.
export const EARLY_SURVEY_COUNT = 8;

export function isMassageTherapistId(id: string): boolean {
  return THERAPIST_IDS.has(id);
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
  return {
    id: therapist.id,
    name: therapist.name,
    count,
    score: count ? surveyScore({ overall, focus, pressure, relief }) : 0,
    overall: count ? round1(overall) : 0,
    focus: count ? round1(focus) : 0,
    pressure: count ? round1(pressure) : 0,
    relief: count ? round1(relief) : 0,
    early: count > 0 && count < EARLY_SURVEY_COUNT,
  };
}

export async function ensureMassageTherapists(): Promise<void> {
  for (const [index, therapist] of MASSAGE_THERAPISTS.entries()) {
    await prisma.massageTherapist.upsert({
      where: { id: therapist.id },
      update: { name: therapist.name, sortOrder: index, active: true },
      create: { id: therapist.id, name: therapist.name, sortOrder: index, active: true },
    });
  }
}

function mentionsMassage(value: string | null | undefined): boolean {
  if (!value) return false;
  return /massage/i.test(value) || value.includes("按摩");
}

export function invoiceMentionsMassage(invoice: {
  title: string;
  notes: string | null;
  items: { name: string; description: string }[];
}): boolean {
  if (mentionsMassage(invoice.title) || mentionsMassage(invoice.notes)) return true;
  return invoice.items.some((item) => mentionsMassage(item.name) || mentionsMassage(item.description));
}

export function massageSurveyUrlFromHeaders(token: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/massage-survey/${token}`;
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/massage-survey/${token}`;
}

export async function ensureMassageSurveyToken(invoiceId: string): Promise<string | null> {
  const existing = await prisma.massageEventLink.findUnique({
    where: { invoiceId },
    select: { token: true },
  });
  if (existing) return existing.token;

  // The code belongs to the calendar event. An invoice that has not been
  // marked on the calendar does not get one.
  const calendarEvent = await prisma.event.findUnique({
    where: { invoiceId },
    select: { id: true },
  });
  if (!calendarEvent) return null;

  const token = generateSigningToken();
  try {
    const created = await prisma.massageEventLink.create({
      data: { invoiceId, token },
      select: { token: true },
    });
    return created.token;
  } catch {
    const again = await prisma.massageEventLink.findUnique({
      where: { invoiceId },
      select: { token: true },
    });
    return again?.token ?? null;
  }
}

export async function therapistStandings(invoiceId?: string): Promise<TherapistStanding[]> {
  await ensureMassageTherapists();
  const [therapists, grouped] = await Promise.all([
    prisma.massageTherapist.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.massageSurvey.groupBy({
      by: ["therapistId"],
      where: invoiceId ? { invoiceId } : undefined,
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
      if (b.score !== a.score) return b.score - a.score;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "zh-HK");
    });
}

export type MassageCalendarEvent = {
  id: string;
  invoiceId: string;
  name: string;
  number: string;
  customerName: string;
  startDate: Date;
  endDate: Date;
  token: string;
  surveyCount: number;
  score: number;
};

export type MassagePendingInvoice = {
  id: string;
  number: string;
  title: string;
  customerName: string;
  issueDate: Date;
};

const massageInvoiceSelect = {
  id: true,
  number: true,
  title: true,
  notes: true,
  customerName: true,
  issueDate: true,
  items: { select: { name: true, description: true } },
  event: { select: { id: true, name: true, startDate: true, endDate: true, companyName: true } },
  massageEvent: { select: { token: true } },
} as const;

export async function listMassageBoard(): Promise<{
  scheduled: MassageCalendarEvent[];
  pending: MassagePendingInvoice[];
}> {
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { event: { isNot: null } },
        { massageEvent: { isNot: null } },
        { title: { contains: "massage", mode: "insensitive" } },
        { title: { contains: "按摩" } },
        { notes: { contains: "massage", mode: "insensitive" } },
        { notes: { contains: "按摩" } },
        { items: { some: { name: { contains: "massage", mode: "insensitive" } } } },
        { items: { some: { name: { contains: "按摩" } } } },
        { items: { some: { description: { contains: "massage", mode: "insensitive" } } } },
        { items: { some: { description: { contains: "按摩" } } } },
      ],
    },
    select: massageInvoiceSelect,
  });

  const scheduledSources = invoices.filter(
    (invoice) =>
      invoice.event &&
      (invoiceMentionsMassage(invoice) || mentionsMassage(invoice.event.name) || invoice.massageEvent)
  );
  const pending = invoices
    .filter((invoice) => !invoice.event && invoiceMentionsMassage(invoice))
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      title: invoice.title,
      customerName: invoice.customerName,
      issueDate: invoice.issueDate,
    }))
    .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());

  const withTokens = await Promise.all(
    scheduledSources.map(async (invoice) => {
      const token = invoice.massageEvent?.token ?? (await ensureMassageSurveyToken(invoice.id));
      return { invoice, token };
    })
  );

  const grouped = await prisma.massageSurvey.groupBy({
    by: ["invoiceId"],
    _avg: { overall: true, focus: true, pressure: true, relief: true },
    _count: { _all: true },
  });
  const byInvoice = new Map(grouped.map((row) => [row.invoiceId, row]));

  const scheduled = withTokens.flatMap(({ invoice, token }) => {
    if (!invoice.event || !token) return [];
    const row = byInvoice.get(invoice.id);
    const count = row?._count._all ?? 0;
    const score = count
      ? surveyScore({
          overall: row?._avg.overall ?? 0,
          focus: row?._avg.focus ?? 0,
          pressure: row?._avg.pressure ?? 0,
          relief: row?._avg.relief ?? 0,
        })
      : 0;
    return [
      {
        id: invoice.event.id,
        invoiceId: invoice.id,
        name: invoice.event.name,
        number: invoice.number,
        customerName: invoice.customerName || invoice.event.companyName,
        startDate: invoice.event.startDate,
        endDate: invoice.event.endDate,
        token,
        surveyCount: count,
        score,
      },
    ];
  });
  scheduled.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  return { scheduled, pending };
}

export async function getMassageCalendarEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      companyName: true,
      invoice: { select: massageInvoiceSelect },
    },
  });
  if (!event) return null;
  const invoice = event.invoice;
  const qualifies =
    invoiceMentionsMassage(invoice) || mentionsMassage(event.name) || !!invoice.massageEvent;
  if (!qualifies) return null;
  const token = invoice.massageEvent?.token ?? (await ensureMassageSurveyToken(invoice.id));
  if (!token) return null;
  return { event, invoice, token };
}
