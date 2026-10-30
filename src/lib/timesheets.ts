import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { computeEntryTotals, currentPeriod, isValidPeriod } from "@/lib/payroll";
import {
  slotMinutes,
  summarizeSlots,
  timesheetBasis,
  unitsFromSlots,
  type TimesheetBasis,
  type TimesheetStatus,
  type WorkSheet,
  type WorkSlot,
} from "@/lib/timesheetMath";

export type { TimesheetBasis, TimesheetStatus, WorkSheet, WorkSlot };
export { summarizeSlots, timesheetBasis, unitsFromSlots };

// Monthly hours live in the existing AccessGroup row `work_timesheets`.
// That row is reserved, so saving page-access groups never deletes it.
// No existing table is altered.
const ROW_ID = "work_timesheets";

function asStatus(value: unknown): TimesheetStatus {
  if (value === "SUBMITTED" || value === "APPROVED" || value === "REJECTED") return value;
  return "SENT";
}

function parseSheet(value: unknown): WorkSheet | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<WorkSheet>;
  if (typeof row.employeeId !== "string" || !row.employeeId) return null;
  if (!isValidPeriod(row.period) || typeof row.token !== "string" || !row.token) return null;
  const slots: WorkSlot[] = [];
  if (Array.isArray(row.slots)) {
    for (const item of row.slots) {
      if (!item || typeof item !== "object") continue;
      const slot = item as Partial<WorkSlot>;
      if (typeof slot.date !== "string" || typeof slot.start !== "string" || typeof slot.end !== "string") continue;
      if (!slot.date.startsWith(`${row.period}-`) || slotMinutes({ date: slot.date, start: slot.start, end: slot.end }) === null) {
        continue;
      }
      slots.push({ date: slot.date, start: slot.start, end: slot.end });
    }
  }
  return {
    employeeId: row.employeeId,
    period: row.period,
    token: row.token,
    status: asStatus(row.status),
    slots,
    note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
    sentAt: typeof row.sentAt === "string" ? row.sentAt : null,
    submittedAt: typeof row.submittedAt === "string" ? row.submittedAt : null,
    decidedAt: typeof row.decidedAt === "string" ? row.decidedAt : null,
  };
}

async function readSheets(): Promise<WorkSheet[]> {
  try {
    const row = await prisma.accessGroup.findUnique({ where: { id: ROW_ID } });
    if (!row?.pages) return [];
    const parsed = JSON.parse(row.pages) as { sheets?: unknown };
    if (!Array.isArray(parsed.sheets)) return [];
    return parsed.sheets.map(parseSheet).filter((sheet): sheet is WorkSheet => !!sheet);
  } catch (err) {
    console.error("read timesheets failed:", err);
    return [];
  }
}

async function writeSheets(sheets: WorkSheet[]): Promise<boolean> {
  const pages = JSON.stringify({ sheets });
  try {
    await prisma.accessGroup.upsert({
      where: { id: ROW_ID },
      create: {
        id: ROW_ID,
        name: "Work timesheets",
        pages,
        emails: "[]",
        sortOrder: 10001,
      },
      update: { pages, name: "Work timesheets" },
    });
    return true;
  } catch (err) {
    console.error("write timesheets failed:", err);
    return false;
  }
}

export async function sheetsForEmployee(employeeId: string): Promise<WorkSheet[]> {
  const sheets = await readSheets();
  return sheets
    .filter((sheet) => sheet.employeeId === employeeId)
    .sort((a, b) => b.period.localeCompare(a.period));
}

export async function submittedTimesheets(): Promise<WorkSheet[]> {
  const sheets = await readSheets();
  return sheets.filter((sheet) => sheet.status === "SUBMITTED").sort((a, b) => a.period.localeCompare(b.period));
}

export async function sheetByToken(token: string): Promise<WorkSheet | null> {
  const sheets = await readSheets();
  return sheets.find((sheet) => sheet.token === token) || null;
}

export function defaultTimesheetPeriod(): string {
  return currentPeriod();
}

/** Open this month's link. An approved month is left as it is. */
export async function openTimesheet(employeeId: string, period: string): Promise<WorkSheet | null> {
  if (!isValidPeriod(period)) return null;
  const sheets = await readSheets();
  const existing = sheets.find((sheet) => sheet.employeeId === employeeId && sheet.period === period);
  if (existing) {
    if (existing.status !== "APPROVED" && !existing.sentAt) {
      existing.sentAt = new Date().toISOString();
      await writeSheets(sheets);
    }
    return existing;
  }
  const created: WorkSheet = {
    employeeId,
    period,
    token: crypto.randomBytes(24).toString("base64url"),
    status: "SENT",
    slots: [],
    note: "",
    sentAt: new Date().toISOString(),
    submittedAt: null,
    decidedAt: null,
  };
  sheets.push(created);
  const saved = await writeSheets(sheets);
  return saved ? created : null;
}

export function cleanSlots(period: string, input: unknown): { slots: WorkSlot[]; error: string | null } {
  if (!Array.isArray(input)) return { slots: [], error: "Add each day you worked." };
  if (input.length > 62) return { slots: [], error: "That is too many days for one month." };
  const slots: WorkSlot[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<WorkSlot>;
    const date = typeof row.date === "string" ? row.date : "";
    const start = typeof row.start === "string" ? row.start : "";
    const end = typeof row.end === "string" ? row.end : "";
    if (!date && !start && !end) continue;
    if (!date.startsWith(`${period}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { slots: [], error: "Each day has to be inside this month." };
    }
    if (slotMinutes({ date, start, end }) === null) {
      return { slots: [], error: "End time has to be later than the start time on the same day." };
    }
    slots.push({ date, start, end });
  }
  slots.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return { slots, error: null };
}

export async function submitTimesheet(token: string, input: unknown): Promise<{ sheet: WorkSheet | null; error: string | null }> {
  const sheets = await readSheets();
  const sheet = sheets.find((item) => item.token === token);
  if (!sheet) return { sheet: null, error: "This link is not valid." };
  if (sheet.status === "APPROVED") return { sheet, error: "These hours are already approved." };
  const cleaned = cleanSlots(sheet.period, input);
  if (cleaned.error) return { sheet: null, error: cleaned.error };
  sheet.slots = cleaned.slots;
  sheet.status = "SUBMITTED";
  sheet.submittedAt = new Date().toISOString();
  sheet.note = "";
  const saved = await writeSheets(sheets);
  return saved ? { sheet, error: null } : { sheet: null, error: "Could not save the hours." };
}

export async function decideTimesheet(
  employeeId: string,
  period: string,
  action: "approve" | "reject",
  note: string
): Promise<WorkSheet | null> {
  const sheets = await readSheets();
  const sheet = sheets.find((item) => item.employeeId === employeeId && item.period === period);
  if (!sheet || sheet.status === "SENT") return null;
  sheet.status = action === "approve" ? "APPROVED" : "REJECTED";
  sheet.note = note.slice(0, 500);
  sheet.decidedAt = new Date().toISOString();
  const saved = await writeSheets(sheets);
  if (!saved) return null;
  if (sheet.status === "APPROVED") await applyApprovedUnits(sheet);
  return sheet;
}

/** Approved hours replace the weekday estimate on a draft payroll run only. */
export async function approvedUnitsFor(
  employeeId: string,
  period: string,
  basis: string
): Promise<number | null> {
  if (basis !== "DAILY" && basis !== "HOURLY") return null;
  const sheets = await readSheets();
  const sheet = sheets.find(
    (item) => item.employeeId === employeeId && item.period === period && item.status === "APPROVED"
  );
  if (!sheet) return null;
  return unitsFromSlots(basis, sheet.slots);
}

async function applyApprovedUnits(sheet: WorkSheet): Promise<void> {
  const run = await prisma.payrollRun.findUnique({
    where: { period: sheet.period },
    include: { entries: true },
  });
  if (!run || run.status !== "DRAFT") return;
  const entry = run.entries.find((item) => item.employeeId === sheet.employeeId);
  if (!entry || (entry.payBasis !== "DAILY" && entry.payBasis !== "HOURLY")) return;
  const unitsWorked = unitsFromSlots(entry.payBasis, sheet.slots);
  const employee = await prisma.employee.findUnique({
    where: { id: entry.employeeId },
    select: { startDate: true },
  });
  const totals = computeEntryTotals({
    payBasis: entry.payBasis,
    rate: entry.rate,
    unitsWorked,
    mpfApplicable: entry.mpfApplicable,
    bonus: entry.bonus,
    employmentType: entry.employmentType,
    startDate: employee?.startDate ?? null,
    period: run.period,
  });
  await prisma.payrollEntry.update({
    where: { id: entry.id },
    data: { unitsWorked, ...totals },
  });
}
