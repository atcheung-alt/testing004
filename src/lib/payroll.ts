// -----------------------------------------------------------------------------
// Core payroll calculation logic — gross pay per employment/pay basis, and
// Hong Kong MPF (Mandatory Provident Fund) mandatory-contribution math.
// Shared by the run-creation route (POST /api/payroll), the per-entry update
// route (PATCH /api/payroll/[id]/entries/[entryId]), and the payslip PDF.
// -----------------------------------------------------------------------------

export const PAYROLL_RUN_STATUSES = ["DRAFT", "FINALIZED"];

// SALARY stands in for the Full time/Intern flat-monthly-salary case, where
// Employee.payRateType is actually null — see payBasisFor() below, the
// single source of truth for turning an employee's employmentType/
// payRateType into one of these four.
export const PAY_BASIS_VALUES = ["SALARY", "DAILY", "HOURLY", "PROJECT_FEE"];
export const PAY_BASIS_LABELS: Record<string, string> = {
  SALARY: "Monthly salary",
  DAILY: "Daily rate",
  HOURLY: "Hourly rate",
  PROJECT_FEE: "Fixed project fee",
};
export const PAY_BASIS_UNIT_LABELS: Record<string, string> = {
  DAILY: "day(s)",
  HOURLY: "hour(s)",
};

// -----------------------------------------------------------------------------
// MPF (Mandatory Provident Fund) — mandatory-contribution bands for a
// monthly-paid employee, per the MPFA (Mandatory Provident Fund Schemes
// Authority): https://www.mpfa.org.hk/en/mpf-system/mandatory-contributions/employees
//
//   Relevant income < $7,100/month   -> employer contributes 5% (uncapped at
//                                        the floor); employee contributes $0.
//   $7,100 - $30,000/month           -> both contribute 5% each.
//   Relevant income > $30,000/month  -> both capped at $1,500 each.
//
// These thresholds are periodically reviewed by the MPFA and should be
// re-checked against mpfa.org.hk if this code is still in use years from
// now. This is a mechanical implementation of the standard statutory
// formula for a typical monthly-paid employee — not a substitute for
// professional payroll/tax advice, and it doesn't account for every
// exemption (under-18/over-65, domestic helpers, and so on). The employee
// contribution holiday is the default tick for a new run (see
// employeeMpfOnHoliday). Staff can still change that tick on the row.
// -----------------------------------------------------------------------------
export const MPF_MIN_RELEVANT_INCOME = 7100;
export const MPF_MAX_RELEVANT_INCOME = 30000;
export const MPF_RATE = 0.05;
export const MPF_MAX_CONTRIBUTION = 1500; // MPF_MAX_RELEVANT_INCOME * MPF_RATE

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeMpf(
  grossPay: number,
  applicable: boolean
): { employeeMpf: number; employerMpf: number } {
  if (!applicable || !grossPay || grossPay <= 0) {
    return { employeeMpf: 0, employerMpf: 0 };
  }
  const cappedIncome = Math.min(grossPay, MPF_MAX_RELEVANT_INCOME);
  // Employer contributes on the actual (capped) income regardless of the
  // lower threshold; employee contributes nothing below it.
  const employerMpf = round2(cappedIncome * MPF_RATE);
  const employeeMpf = grossPay < MPF_MIN_RELEVANT_INCOME ? 0 : round2(cappedIncome * MPF_RATE);
  return { employeeMpf, employerMpf };
}

const HK_SHIFT_MS = 8 * 60 * 60 * 1000;

function hkYmd(date: Date): { y: number; m: number; d: number } {
  const shifted = new Date(date.getTime() + HK_SHIFT_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

function ymdNumber(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

function addCalendarDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
}

function endOfMonth(y: number, m: number): { y: number; m: number; d: number } {
  const last = new Date(Date.UTC(y, m, 0));
  return { y: last.getUTCFullYear(), m: last.getUTCMonth() + 1, d: last.getUTCDate() };
}

/**
 * Employee MPF holiday for one payroll month (MPFA).
 * No employee deduction for the first 30 days of employment, or for the
 * rest of the calendar month that contains the 30th day. The next month
 * is the first month with an employee deduction. Employer MPF is not on
 * this holiday — it is counted from the first day.
 * Example: onboard 8 Oct 2026 → 30th day is 6 Nov → holiday through
 * November → employee MPF starts December.
 */
export function employeeMpfOnHoliday(startDate: Date | null, period: string): boolean {
  if (!startDate || !isValidPeriod(period)) return false;
  const start = hkYmd(startDate);
  const day30 = addCalendarDays(start.y, start.m, start.d, 29);
  const holidayEnd = endOfMonth(day30.y, day30.m);
  const [year, month] = period.split("-").map(Number);
  const periodEnd = endOfMonth(year, month);
  return ymdNumber(periodEnd.y, periodEnd.m, periodEnd.d) <= ymdNumber(holidayEnd.y, holidayEnd.m, holidayEnd.d);
}

/** Gross pay for one entry, given its pay basis/rate/units worked. */
export function computeGrossPay(payBasis: string, rate: number, unitsWorked: number): number {
  if (payBasis === "DAILY" || payBasis === "HOURLY") {
    return round2((rate || 0) * (unitsWorked || 0));
  }
  // SALARY and PROJECT_FEE are both flat amounts, not per-unit.
  return round2(rate || 0);
}

export function computeEntryTotals(input: {
  payBasis: string;
  rate: number;
  unitsWorked: number;
  mpfApplicable: boolean;
  // One-off bonus on top of gross pay — only ever non-zero for Full time
  // entries (see the FULL_TIME check in the entries PATCH route), but this
  // function itself doesn't need to know that; it just folds whatever bonus
  // it's given into net pay. Deliberately excluded from the MPF base (see
  // the schema comment on PayrollEntry.bonus) — computeMpf still runs off
  // grossPay alone.
  bonus?: number;
  // Used only to keep employer MPF on during the employee holiday when the
  // tick is off. Missing values keep the old "tick controls both sides".
  employmentType?: string | null;
  startDate?: Date | null;
  period?: string | null;
}): { grossPay: number; employeeMpf: number; employerMpf: number; netPay: number } {
  const grossPay = computeGrossPay(input.payBasis, input.rate, input.unitsWorked);
  const holiday =
    input.startDate && input.period ? employeeMpfOnHoliday(input.startDate, input.period) : false;
  const eligible =
    input.employmentType != null
      ? input.employmentType !== "FREELANCE" && input.employmentType !== "INTERN"
      : false;
  // The tick is the employee deduction. Staff can turn it on during the
  // holiday or off after it. Employer 5% still runs from day 1 for an
  // ordinary employee while that holiday is the reason the tick is off.
  const employerOn = input.mpfApplicable || (eligible && holiday);
  const employeeMpf = computeMpf(grossPay, input.mpfApplicable).employeeMpf;
  const employerMpf = computeMpf(grossPay, employerOn).employerMpf;
  const bonus = round2(input.bonus || 0);
  return { grossPay, employeeMpf, employerMpf, netPay: round2(grossPay + bonus - employeeMpf) };
}

/**
 * Which pay basis an employee is actually paid under — see the Employee
 * schema comment and PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE in src/lib/
 * employees.ts. Full time (or an employee with no employmentType/
 * payRateType set at all) falls back to SALARY.
 */
export function payBasisFor(employmentType: string | null, payRateType: string | null): string {
  if (
    (employmentType === "INTERN" || employmentType === "PART_TIME" || employmentType === "FREELANCE") &&
    payRateType
  ) {
    return payRateType;
  }
  return "SALARY";
}

/** The rate that applies for a given pay basis — `salary` for SALARY, `payRate` otherwise. */
export function rateFor(payBasis: string, salary: number, payRate: number): number {
  return payBasis === "SALARY" ? salary : payRate;
}

/**
 * Freelancers are typically contractors-for-service rather than employees
 * in the MPF sense — a genuinely self-employed person enrols themselves in
 * their own MPF scheme rather than through this "employer", so MPF
 * defaults off for them. Interns default off too — the vast majority of
 * internships run under the 60-day casual-employee exemption (or close to
 * it) before MPF enrolment would even apply, so defaulting to "on" would be
 * wrong far more often than not. Full time/Part time are ordinary ongoing
 * employees and default to MPF applying, except during the employee
 * contribution holiday (see employeeMpfOnHoliday). Always just a starting
 * point — editable per entry (e.g. a long-term intern/freelancer the
 * company treats as a de facto employee for MPF purposes, or a holiday
 * month where staff still want the employee deduction).
 */
export function defaultMpfApplicable(
  employmentType: string | null,
  startDate?: Date | null,
  period?: string | null
): boolean {
  if (employmentType === "FREELANCE" || employmentType === "INTERN") return false;
  if (startDate && period && employeeMpfOnHoliday(startDate, period)) return false;
  return true;
}

// -----------------------------------------------------------------------------
// MPF enrollment deadline reminder — a separate concept from the per-payroll-
// entry `mpfApplicable` math above. This tracks whether staff have actually
// completed enrolling a new hire with an MPF trustee, surfaced as a reminder
// on the employee list page (see mpfReminderFor) until Employee.mpfVerifiedAt
// is set. Scoped to FULL_TIME only, matching the "Full-time & Part-time
// default MPF on" split above — but narrowed further to Full time alone,
// since Part time's ongoing-but-often-short engagements make a hard deadline
// less clear-cut, and the business asked for Full time specifically.
// -----------------------------------------------------------------------------
export const MPF_DEADLINE_DAYS = 60; // mirrors the 60-day casual-employee exemption window referenced above

export type MpfReminderSeverity = "upcoming" | "overdue";

export type MpfReminder = {
  deadline: Date;
  daysRemaining: number; // negative once overdue
  severity: MpfReminderSeverity;
  label: string;
};

/** The statutory-ish enrollment deadline: `startDate` + MPF_DEADLINE_DAYS. */
export function mpfDeadlineFor(startDate: Date): Date {
  return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + MPF_DEADLINE_DAYS);
}

/**
 * Whether (and what) MPF deadline reminder to show for an employee — null
 * means no reminder should be shown. Only applies to FULL_TIME employees
 * with a known start date and no mpfVerifiedAt yet; hides itself the moment
 * either of those stops being true (employee type changed, or staff marked
 * MPF verified).
 */
export function mpfReminderFor(
  employmentType: string | null,
  startDate: Date | null,
  mpfVerifiedAt: Date | null
): MpfReminder | null {
  if (employmentType !== "FULL_TIME" || mpfVerifiedAt || !startDate) return null;

  const deadline = mpfDeadlineFor(startDate);
  const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) {
    return {
      deadline,
      daysRemaining,
      severity: "overdue",
      label: `MPF overdue (${Math.abs(daysRemaining)}d)`,
    };
  }
  return {
    deadline,
    daysRemaining,
    severity: "upcoming",
    label: daysRemaining === 0 ? "MPF due today" : `MPF due in ${daysRemaining}d`,
  };
}

/** Weekday (Mon-Fri) count for a "YYYY-MM" period — used as a starting-point
 *  default for how many days/hours someone worked, before staff adjusts it
 *  down for any leave/absence actually taken. */
export function weekdaysInPeriod(period: string): number {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(y, m - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export function defaultUnitsWorked(payBasis: string, period: string): number {
  if (payBasis === "DAILY") return weekdaysInPeriod(period);
  if (payBasis === "HOURLY") return weekdaysInPeriod(period) * 8;
  if (payBasis === "PROJECT_FEE") return 1;
  return 0;
}

/** "2026-08" -> "August 2026", or the Chinese month name when a PDF language
 *  is passed. Falls back to the raw string if malformed. Callers that omit
 *  `language` keep the English label. */
export function periodLabel(period: string, language?: string | null): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const locale = language === "ZH_HANS" ? "zh-CN" : language === "ZH_HANT" ? "zh-HK" : "en-GB";
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function currentPeriod(asOf: Date = new Date()): string {
  return `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidPeriod(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
