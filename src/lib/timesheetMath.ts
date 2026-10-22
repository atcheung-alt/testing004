export type TimesheetBasis = "DAILY" | "HOURLY";
export type TimesheetStatus = "SENT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type WorkSlot = {
  date: string;
  start: string;
  end: string;
};

export type WorkSheet = {
  employeeId: string;
  period: string;
  token: string;
  status: TimesheetStatus;
  slots: WorkSlot[];
  note: string;
  sentAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function timesheetBasis(
  employmentType: string | null | undefined,
  payRateType: string | null | undefined
): TimesheetBasis | null {
  if (employmentType !== "PART_TIME" && employmentType !== "FREELANCE") return null;
  if (payRateType === "DAILY" || payRateType === "HOURLY") return payRateType;
  return null;
}

export function slotMinutes(slot: WorkSlot): number | null {
  if (!TIME.test(slot.start) || !TIME.test(slot.end)) return null;
  const [sh, sm] = slot.start.split(":").map(Number);
  const [eh, em] = slot.end.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes : null;
}

export function summarizeSlots(slots: WorkSlot[]): { hours: number; days: number } {
  const minutes = slots.reduce((sum, slot) => sum + (slotMinutes(slot) || 0), 0);
  return {
    hours: Math.round((minutes / 60) * 100) / 100,
    days: new Set(slots.map((slot) => slot.date)).size,
  };
}

export function unitsFromSlots(basis: TimesheetBasis, slots: WorkSlot[]): number {
  const summary = summarizeSlots(slots);
  return basis === "DAILY" ? summary.days : summary.hours;
}
