const HK = "Asia/Hong_Kong";

export function hongKongDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Pending until this calendar day in Hong Kong. That day, and after, is done. */
export function commissionReached(date: Date, now = new Date()): boolean {
  return hongKongDay(date) <= hongKongDay(now);
}

export function commissionDateName(workKind: string): string {
  return workKind === "RECRUITMENT" ? "Target onboarding day" : "Recognise invoice day";
}

export function commissionMarkDescription(workKind: string, day: string): string {
  return `${workKind} ${day}`;
}

export function parseCommissionMark(
  description: string | null | undefined
): { workKind: "EVENT" | "RECRUITMENT"; day: string } | null {
  const match = /^(EVENT|RECRUITMENT) (\d{4}-\d{2}-\d{2})$/.exec(String(description || "").trim());
  if (!match) return null;
  return { workKind: match[1] as "EVENT" | "RECRUITMENT", day: match[2] };
}

/** Pending until this calendar day. That day, and after, is done. */
export function commissionDayReached(day: string, now = new Date()): boolean {
  return day <= hongKongDay(now);
}

export function formatCommissionDay(day: string): string {
  const [year, month, date] = day.split("-");
  if (!year || !month || !date) return day;
  return `${date}/${month}/${year}`;
}

export function commissionFieldsFrom(
  body: { workKind?: unknown; commissionOn?: unknown },
  required: boolean
): { workKind: string; commissionOn: Date | null; error: string | null } {
  const workKind = typeof body.workKind === "string" ? body.workKind.trim().toUpperCase() : "";
  const raw = typeof body.commissionOn === "string" ? body.commissionOn.trim() : "";
  if (!workKind && !raw) {
    if (required) {
      return { workKind: "", commissionOn: null, error: "Choose Event or Recruitment, and fill in the date." };
    }
    return { workKind: "", commissionOn: null, error: null };
  }
  if (workKind !== "EVENT" && workKind !== "RECRUITMENT") {
    return { workKind: "", commissionOn: null, error: "Choose Event or Recruitment." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { workKind, commissionOn: null, error: "Fill in the date." };
  }
  const commissionOn = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(commissionOn.getTime())) {
    return { workKind, commissionOn: null, error: "Fill in the date." };
  }
  return { workKind, commissionOn, error: null };
}
