// -----------------------------------------------------------------------------
// Shared helpers for the Employee record + leave-request feature — request
// body normalization/validation (mirrors the customerFieldsFrom/
// eventFieldsFrom pattern in document-helpers.ts) and the leave-balance
// calculation used by both the staff Employees pages and the public
// /leave/{token} self-service link.
// -----------------------------------------------------------------------------

import { isValidEmail } from "@/lib/settings";

// ONBOARDING is a system-managed transitional state: an invited employee
// starts here (see /api/employees/invite) and only leaves it automatically,
// once staff verifies their signed contract (see the contract verify route).
// Staff can still reassign it manually from the Edit form if needed.
export const VALID_EMPLOYEE_STATUSES = ["ACTIVE", "ONBOARDING", "FORMER"];
export const VALID_LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"];
export const VALID_EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "INTERN", "FREELANCE"];
export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  INTERN: "Intern",
  FREELANCE: "Freelance",
};

// Full time is paid a flat monthly `salary` — there's no `payRateType` for
// it, so it's simply absent from the map below. Intern can be paid either a
// flat monthly salary (payRateType left null, same as Full time) or an
// hourly rate — see the `payRateType || null` branch EmployeeForm.tsx uses
// for it, distinct from Part time/Freelance below, which must pick a rate
// type. Part time can be daily- or hourly-rated; Freelance adds a one-off
// fixed project fee on top of those same two options. This map is the
// single source of truth for which `payRateType` values are valid for a
// given `employmentType` — both the Employee form (to restrict the
// dropdown) and employeeFieldsFrom below (to reject/clear anything that
// doesn't belong to the current employmentType) key off it.
export const PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE: Record<string, string[]> = {
  INTERN: ["HOURLY"],
  PART_TIME: ["DAILY", "HOURLY"],
  FREELANCE: ["DAILY", "HOURLY", "PROJECT_FEE"],
};
export const PAY_RATE_TYPE_LABELS: Record<string, string> = {
  DAILY: "Daily rate",
  HOURLY: "Hourly rate",
  PROJECT_FEE: "Fixed project fee",
};

// Only Full time (or an unset employment type — treated as full time by
// default) accrues annual leave. Intern, Part time, and Freelance are all
// explicitly not entitled to it per company policy — the intern and
// freelance contract letters already say so outright (see
// employeeContractTerms.ts), and the same rule extends to Part time. Single
// source of truth so the Employee form, the contract prerequisites check,
// and the self-service Profile page's leave section all agree.
export function hasAnnualLeaveEntitlement(employmentType: string | null | undefined): boolean {
  return employmentType !== "INTERN" && employmentType !== "PART_TIME" && employmentType !== "FREELANCE";
}

// The set of Employee columns considered non-sensitive — safe to show to any
// signed-in staff account. Everything else (HKID, address, birthday, salary,
// bankName, bankAccount, bankCardName, leavingReason) is admin-only and must
// never appear in a Prisma `select`/`include` built for a non-admin request;
// see the Employees list/detail pages and the /api/employees routes, which
// all branch on session.isAdmin to pick between this and a full fetch.
export const EMPLOYEE_STAFF_SELECT = {
  id: true,
  name: true,
  title: true,
  gender: true,
  employmentType: true,
  annualLeaveDays: true,
  startDate: true,
  lastDay: true,
  status: true,
  leaveToken: true,
  companyEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** `${surname} ${given}` (English convention used throughout this app —
 *  matches the official IR56B sample's own "LAM" + "FUNG" ordering), empty
 *  parts dropped so a surname-only name doesn't end with a trailing space. */
function deriveFullName(surname: string, given: string): string {
  return [surname.trim(), given.trim()].filter(Boolean).join(" ");
}

/** `${surname}${given}` with NO space — Chinese names are conventionally
 *  written together (e.g. 陳大文), unlike English ones. Null if both parts
 *  are blank, matching how nameChinese was optional before this split. */
function deriveFullNameChinese(surname: string | null | undefined, given: string | null | undefined): string | null {
  const joined = [surname?.trim(), given?.trim()].filter(Boolean).join("");
  return joined || null;
}

/** Best-effort split of a single free-text name into surname/given name,
 *  for the couple of flows (invite, legacy data) that only ever collected
 *  one combined field — first word = surname, matching the IR56B sample's
 *  own convention. Not meant to be authoritative; anyone relying on the
 *  split fields can correct it later via the edit form or onboarding. */
export function splitNameGuess(fullName: string): { surname: string; given: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { surname: "", given: "" };
  const [surname, ...rest] = trimmed.split(/\s+/);
  return { surname, given: rest.join(" ") };
}

export type EmployeeFields = {
  name: string;
  surnameEn: string;
  givenNameEn: string;
  preferredName: string | null;
  nickname: string | null;
  companyId: string | null;
  title: string;
  salary: number;
  // See PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE above — only ever non-null/non-zero
  // for Part time/Freelance, and only for a payRateType actually valid for
  // whatever employmentType is set below.
  payRateType: string | null;
  payRate: number;
  annualLeaveDays: number;
  startDate: Date | null;
  hkid: string | null;
  address: string | null;
  gender: string | null;
  birthday: Date | null;
  bankName: string | null;
  bankAccount: string | null;
  bankCardName: string | null;
  lastDay: Date | null;
  leavingReason: string | null;
  status: string;
  employmentType: string | null;
  // The employee's work email — see the Employee.companyEmail comment in
  // schema.prisma. Matched against a logged-in User's email to link them to
  // the /hr/profile self-service tab.
  companyEmail: string | null;
  // Onboarding-related — same fields the public /onboarding/{token} form
  // collects, also editable here so admin isn't locked out of correcting
  // them manually. See the Employee.email/onboarding* comment in
  // schema.prisma for what each one means.
  email: string | null;
  nameChinese: string | null;
  surnameChinese: string | null;
  givenNameChinese: string | null;
  nationality: string | null;
  phone: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  bankCode: string | null;
  error: string | null;
};

/**
 * Extract and validate an employee record's fields from a staff-submitted
 * request body. Only the name is actually required — everything else (bank
 * details, HKID, birthday, etc.) may simply not be on hand yet. `status`
 * is trusted as given (the New/Edit form is what decides whether filling in
 * a Last day should flip it to FORMER — see EmployeeForm.tsx); this layer
 * just falls back to ACTIVE if it's missing or not a recognized value.
 */
export function employeeFieldsFrom(body: any): EmployeeFields {
  const surnameEn = (body.surnameEn || "").trim();
  const givenNameEn = (body.givenNameEn || "").trim();
  if (!surnameEn) {
    return {
      name: "",
      surnameEn: "",
      givenNameEn: "",
      preferredName: null,
      nickname: null,
      companyId: null,
      title: "",
      salary: 0,
      payRateType: null,
      payRate: 0,
      annualLeaveDays: 0,
      startDate: null,
      hkid: null,
      address: null,
      gender: null,
      birthday: null,
      bankName: null,
      bankAccount: null,
      bankCardName: null,
      lastDay: null,
      leavingReason: null,
      status: "ACTIVE",
      employmentType: null,
      companyEmail: null,
      email: null,
      nameChinese: null,
      surnameChinese: null,
      givenNameChinese: null,
      nationality: null,
      phone: null,
      personalEmail: null,
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
      bankCode: null,
      error: "Employee surname is required.",
    };
  }

  const requestedStatus = typeof body.status === "string" ? body.status : undefined;
  const status =
    requestedStatus && VALID_EMPLOYEE_STATUSES.includes(requestedStatus) ? requestedStatus : "ACTIVE";

  const requestedEmploymentType = typeof body.employmentType === "string" ? body.employmentType : undefined;
  const employmentType =
    requestedEmploymentType && VALID_EMPLOYMENT_TYPES.includes(requestedEmploymentType)
      ? requestedEmploymentType
      : null;

  // payRateType only ever survives if it's actually one of the options
  // valid for this employmentType (PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE has no
  // entry at all for FULL_TIME/null, so anything submitted for those is
  // dropped; INTERN's entry is ["HOURLY"] — submitting nothing/null for an
  // intern is exactly how they end up on the flat-salary basis instead) —
  // this is what clears out a stale day/hourly rate left over from before
  // someone was switched, say, from Freelance to Full time.
  const allowedPayRateTypes = employmentType ? PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE[employmentType] : undefined;
  const requestedPayRateType = typeof body.payRateType === "string" ? body.payRateType : undefined;
  const payRateType =
    allowedPayRateTypes && requestedPayRateType && allowedPayRateTypes.includes(requestedPayRateType)
      ? requestedPayRateType
      : null;

  const surnameChinese = trimmedOrNull(body.surnameChinese);
  const givenNameChinese = trimmedOrNull(body.givenNameChinese);

  return {
    name: deriveFullName(surnameEn, givenNameEn),
    surnameEn,
    givenNameEn,
    preferredName: trimmedOrNull(body.preferredName),
    nickname: trimmedOrNull(body.nickname)?.slice(0, 40) || null,
    companyId: typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null,
    title: (body.title || "").trim(),
    salary: Number(body.salary) || 0,
    // Meaningless without a payRateType, so kept at 0 alongside it rather
    // than trusting whatever number the client happened to still be
    // holding for a pay basis that no longer applies.
    payRateType,
    payRate: payRateType ? Number(body.payRate) || 0 : 0,
    // Only Full time accrues annual leave (see hasAnnualLeaveEntitlement
    // above) — forced to 0 here regardless of what the form submits, same
    // belt-and-braces pattern as payRate above.
    annualLeaveDays: hasAnnualLeaveEntitlement(employmentType) ? Number(body.annualLeaveDays) || 0 : 0,
    startDate: parseOptionalDate(body.startDate),
    hkid: trimmedOrNull(body.hkid),
    address: trimmedOrNull(body.address),
    gender: trimmedOrNull(body.gender),
    birthday: parseOptionalDate(body.birthday),
    bankName: trimmedOrNull(body.bankName),
    bankAccount: trimmedOrNull(body.bankAccount),
    bankCardName: trimmedOrNull(body.bankCardName),
    lastDay: parseOptionalDate(body.lastDay),
    leavingReason: trimmedOrNull(body.leavingReason),
    status,
    employmentType,
    companyEmail: trimmedOrNull(body.companyEmail),
    email: trimmedOrNull(body.email),
    nameChinese: deriveFullNameChinese(surnameChinese, givenNameChinese),
    surnameChinese,
    givenNameChinese,
    nationality: trimmedOrNull(body.nationality),
    phone: trimmedOrNull(body.phone),
    personalEmail: trimmedOrNull(body.personalEmail),
    emergencyContactName: trimmedOrNull(body.emergencyContactName),
    emergencyContactRelationship: trimmedOrNull(body.emergencyContactRelationship),
    emergencyContactPhone: trimmedOrNull(body.emergencyContactPhone),
    bankCode: trimmedOrNull(body.bankCode),
    error: null,
  };
}

export type OnboardingSubmissionFields = {
  name: string;
  surnameEn: string;
  givenNameEn: string;
  nameChinese: string | null;
  surnameChinese: string | null;
  givenNameChinese: string | null;
  hkid: string;
  gender: string;
  birthday: Date;
  nationality: string;
  phone: string;
  personalEmail: string;
  address: string;
  emergencyContactName: string;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string;
  bankName: string;
  bankCode: string | null;
  bankCardName: string;
  bankAccount: string;
  declarationAccuracy: boolean;
  declarationConsent: boolean;
  // Raw `data:...;base64,...` URLs, not yet uploaded — the submit route
  // decodes and pushes these to the employee's Drive folder itself (see
  // uploadEmployeeOnboardingDocument in src/lib/driveSync.ts); this
  // validator only checks that something well-formed and within limits was
  // attached, since it has no way to reach Google Drive from here.
  addressProofData: string;
  bankStatementData: string;
  hkidDocumentData: string;
  error: string | null;
};

const ONBOARDING_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_ONBOARDING_DOCUMENT_BYTES = 3 * 1024 * 1024; // 3MB per file so one upload stays under the host's request limit

/**
 * Validates one onboarding document upload's `data:` URL shape/type/size
 * without importing the server-only mailer.ts helper of the same idea —
 * this file is imported from client components (EmployeeListClient,
 * EmployeeForm), so pulling mailer.ts's nodemailer dependency in here would
 * bundle it into the browser. Returns an error message, or null if valid.
 */
export function onboardingDocumentError(dataUrl: unknown, label: string): string | null {
  if (typeof dataUrl !== "string" || !dataUrl) return `Please attach ${label}.`;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return `Please attach ${label}.`;
  const capitalized = `${label[0].toUpperCase()}${label.slice(1)}`;
  if (!ONBOARDING_DOCUMENT_TYPES.includes(match[1])) {
    return `${capitalized} must be a PDF, JPG, or PNG file.`;
  }
  // Approximate the decoded byte size (base64 inflates by ~4/3) without
  // actually decoding — decoding here would just be thrown away.
  const approxBytes = Math.floor((match[2].length * 3) / 4);
  if (approxBytes > MAX_ONBOARDING_DOCUMENT_BYTES) {
    return `${capitalized} is too large — please keep it under 3 MB.`;
  }
  return null;
}

/**
 * Extract and validate a submission from the public /onboarding/{token}
 * form. Unlike `employeeFieldsFrom` (used by the admin-only create/edit
 * form, where only name is required), almost everything here IS required —
 * this is the one and only chance the employee gets to fill it in before
 * the form locks for good. Only the Chinese name, emergency-contact
 * relationship, and bank code are optional, matching what was asked for.
 */
export function onboardingSubmissionFieldsFrom(body: any): OnboardingSubmissionFields {
  const fail = (error: string): OnboardingSubmissionFields => ({
    name: "",
    surnameEn: "",
    givenNameEn: "",
    nameChinese: null,
    surnameChinese: null,
    givenNameChinese: null,
    hkid: "",
    gender: "",
    birthday: new Date(0),
    nationality: "",
    phone: "",
    personalEmail: "",
    address: "",
    emergencyContactName: "",
    emergencyContactRelationship: null,
    emergencyContactPhone: "",
    bankName: "",
    bankCode: null,
    bankCardName: "",
    bankAccount: "",
    declarationAccuracy: false,
    declarationConsent: false,
    addressProofData: "",
    bankStatementData: "",
    hkidDocumentData: "",
    error,
  });

  const surnameEn = (body.surnameEn || "").trim();
  if (!surnameEn) return fail("English surname is required.");
  const givenNameEn = (body.givenNameEn || "").trim();
  if (!givenNameEn) return fail("English given name is required.");

  const hkid = (body.hkid || "").trim();
  if (!hkid) return fail("HKID is required.");

  const gender = (body.gender || "").trim();
  if (!gender) return fail("Gender is required.");

  const birthday = parseOptionalDate(body.birthday);
  if (!birthday) return fail("Date of birth is required.");

  const nationality = (body.nationality || "").trim();
  if (!nationality) return fail("Nationality is required.");

  const phone = (body.phone || "").trim();
  if (!phone) return fail("Phone number is required.");

  const personalEmail = (body.personalEmail || "").trim();
  if (!personalEmail) return fail("Personal email is required.");
  if (!isValidEmail(personalEmail)) return fail("Personal email doesn't look like a valid address.");

  const address = (body.address || "").trim();
  if (!address) return fail("Address is required.");

  const emergencyContactName = (body.emergencyContactName || "").trim();
  if (!emergencyContactName) return fail("Emergency contact name is required.");

  const emergencyContactPhone = (body.emergencyContactPhone || "").trim();
  if (!emergencyContactPhone) return fail("Emergency contact phone number is required.");

  const bankName = (body.bankName || "").trim();
  if (!bankName) return fail("Bank name is required.");

  const bankCardName = (body.bankCardName || "").trim();
  if (!bankCardName) return fail("Account holder name is required.");

  const bankAccount = (body.bankAccount || "").trim();
  if (!bankAccount) return fail("Bank account number is required.");

  const surnameChinese = trimmedOrNull(body.surnameChinese);
  const givenNameChinese = trimmedOrNull(body.givenNameChinese);

  const documentsAlreadyUploaded = body.documentsAlreadyUploaded === true;
  if (!documentsAlreadyUploaded) {
    const addressProofError = onboardingDocumentError(body.addressProofData, "your proof of address");
    if (addressProofError) return fail(addressProofError);
    const bankStatementError = onboardingDocumentError(body.bankStatementData, "your bank statement");
    if (bankStatementError) return fail(bankStatementError);
    const hkidDocumentError = onboardingDocumentError(body.hkidDocumentData, "a copy of your HKID");
    if (hkidDocumentError) return fail(hkidDocumentError);
  }

  if (body.declarationAccuracy !== true) {
    return fail("Please confirm the declaration that your information is accurate.");
  }
  if (body.declarationConsent !== true) {
    return fail("Please confirm the data consent declaration.");
  }

  return {
    name: deriveFullName(surnameEn, givenNameEn),
    surnameEn,
    givenNameEn,
    nameChinese: deriveFullNameChinese(surnameChinese, givenNameChinese),
    surnameChinese,
    givenNameChinese,
    hkid,
    gender,
    birthday,
    nationality,
    phone,
    personalEmail,
    address,
    emergencyContactName,
    emergencyContactRelationship: trimmedOrNull(body.emergencyContactRelationship),
    emergencyContactPhone,
    bankName,
    bankCode: trimmedOrNull(body.bankCode),
    bankCardName,
    bankAccount,
    declarationAccuracy: true,
    declarationConsent: true,
    addressProofData: documentsAlreadyUploaded ? "" : body.addressProofData,
    bankStatementData: documentsAlreadyUploaded ? "" : body.bankStatementData,
    hkidDocumentData: documentsAlreadyUploaded ? "" : body.hkidDocumentData,
    error: null,
  };
}

/**
 * Extract and validate a new leave request's fields from the public
 * /leave/{token} submission. Start date is required; end date defaults to
 * the start date (a single-day request) and must not be earlier than it.
 */
export function leaveRequestFieldsFrom(body: any): {
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
  isHalfDay: boolean;
  halfDayPeriod: string | null;
  error: string | null;
} {
  const startDate = parseOptionalDate(body.startDate);
  if (!startDate) {
    return {
      startDate: null,
      endDate: null,
      reason: "",
      isHalfDay: false,
      halfDayPeriod: null,
      error: "A start date is required.",
    };
  }
  const endDate = body.endDate ? parseOptionalDate(body.endDate) : startDate;
  if (!endDate) {
    return {
      startDate: null,
      endDate: null,
      reason: "",
      isHalfDay: false,
      halfDayPeriod: null,
      error: "That end date isn't valid.",
    };
  }
  if (endDate.getTime() < startDate.getTime()) {
    return {
      startDate: null,
      endDate: null,
      reason: "",
      isHalfDay: false,
      halfDayPeriod: null,
      error: "End date must be on or after the start date.",
    };
  }

  const isHalfDay = body.isHalfDay === true;
  let halfDayPeriod: string | null = null;
  if (isHalfDay) {
    // A half-day only makes sense for a single day off — reject anything
    // spanning more than one day rather than silently ignoring the flag.
    if (endDate.getTime() !== startDate.getTime()) {
      return {
        startDate: null,
        endDate: null,
        reason: "",
        isHalfDay: false,
        halfDayPeriod: null,
        error: "A half-day request must be for a single day.",
      };
    }
    if (body.halfDayPeriod !== "AM" && body.halfDayPeriod !== "PM") {
      return {
        startDate: null,
        endDate: null,
        reason: "",
        isHalfDay: false,
        halfDayPeriod: null,
        error: "Please specify morning (AM) or afternoon (PM) for a half-day request.",
      };
    }
    halfDayPeriod = body.halfDayPeriod;
  }

  return {
    startDate,
    endDate,
    reason: (body.reason || "").trim(),
    isHalfDay,
    halfDayPeriod,
    error: null,
  };
}

/** Whole days spanned by [start, end], inclusive of both ends. */
export function daysBetweenInclusive(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  const ms = e.getTime() - s.getTime();
  return Math.max(0, Math.round(ms / 86400000) + 1);
}

type LeaveSpan = {
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  isHalfDay?: boolean;
};

/** Days a single leave request spans — 0.5 for a half-day request,
 *  otherwise the normal inclusive day count. */
export function requestDuration(request: LeaveSpan): number {
  if (request.isHalfDay) return 0.5;
  return daysBetweenInclusive(request.startDate, request.endDate);
}

/** Total days used across every APPROVED leave request. */
export function computeLeaveUsed(requests: LeaveSpan[]): number {
  return requests
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + requestDuration(r), 0);
}

/**
 * Whole days of service completed between `startDate` and `asOf` (defaults
 * to now). Clamped to 0 for a future start date rather than going negative.
 */
export function daysOfService(startDate: Date | string, asOf: Date = new Date()): number {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const ms = asOf.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/**
 * The entitlement actually accrued so far, rather than handing over the
 * full annual figure on day one — leave builds up proportionally to how
 * many days someone's been here (annualLeaveDays × daysOfService / 365),
 * a genuine float rather than a month-granularity step function, capped at
 * the full annual amount once they pass a year of service. That cap
 * doesn't reset year over year — consistent with the "lifetime running
 * total" simplification already noted on Employee.annualLeaveDays in
 * schema.prisma, rather than a real per-anniversary accrual scheme.
 *
 * A record with no startDate on file (older employees added before this
 * field was required, or before this accrual logic existed) gets the full
 * annual amount rather than 0 — there's no service length to prorate
 * against, and silently zeroing out someone's balance because of missing
 * data would read as a bug, not the missing-data case it actually is.
 */
// Rounds to 2 decimal places without snapping to any coarser step — just
// keeps floats from carrying ugly binary tails (e.g. 6.038356164383562, or
// -0.9700000000000002 once a whole-number `used` is subtracted from an
// already-rounded entitlement — floating point subtraction reintroduces
// its own tail even when both operands looked clean).
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeAccruedEntitlement(
  annualLeaveDays: number,
  startDate: Date | string | null,
  asOf: Date = new Date()
): number {
  if (!startDate) return annualLeaveDays;
  const days = Math.min(daysOfService(startDate, asOf), 365);
  return round2((annualLeaveDays * days) / 365);
}

/**
 * An employee's leave balance: accrued entitlement (see
 * computeAccruedEntitlement above) minus every APPROVED request's days
 * (PENDING/REJECTED requests don't touch the balance).
 */
export function computeLeaveBalance(
  annualLeaveDays: number,
  startDate: Date | string | null,
  requests: LeaveSpan[]
): { entitlement: number; used: number; remaining: number } {
  const entitlement = computeAccruedEntitlement(annualLeaveDays, startDate);
  const used = computeLeaveUsed(requests);
  return { entitlement, used, remaining: round2(entitlement - used) };
}

type ContractPrerequisiteInput = {
  onboardingCompletedAt: Date | string | null;
  title: string;
  salary: number;
  employmentType: string | null;
  payRateType: string | null;
  payRate: number;
  annualLeaveDays: number;
  startDate: Date | string | null;
};

/**
 * Everything that needs to be true before staff can create an employment
 * contract, per the onboarding workflow: employee submits onboarding ->
 * staff reviews it -> staff fills in title/salary/leave -> THEN staff fills
 * in contract details. Returns a list of human-readable missing items
 * (empty = ready to go) rather than a plain boolean, so the UI can tell the
 * staff member exactly what's left instead of just blocking them.
 */
export function getContractPrerequisiteIssues(employee: ContractPrerequisiteInput): string[] {
  const issues: string[] = [];
  if (!employee.onboardingCompletedAt) {
    issues.push("Employee hasn't completed onboarding yet");
  }
  if (!employee.title.trim()) {
    issues.push("Job title");
  }
  // Part time/Freelance are paid a rate (hour/day/project fee) instead of a
  // monthly salary, so the "pay is set" check branches on employmentType
  // rather than always requiring `salary`. Intern is the one type that can
  // legitimately go either way (see PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE above)
  // — accept whichever one is actually filled in.
  const requiresPayRate =
    employee.employmentType === "PART_TIME" || employee.employmentType === "FREELANCE";
  const hasValidPayRate = !!employee.payRateType && !!employee.payRate && employee.payRate > 0;
  const hasValidSalary = !!employee.salary && employee.salary > 0;
  if (requiresPayRate) {
    if (!hasValidPayRate) {
      issues.push("Pay rate");
    }
  } else if (employee.employmentType === "INTERN") {
    if (!hasValidPayRate && !hasValidSalary) {
      issues.push("Salary or pay rate");
    }
  } else if (!hasValidSalary) {
    issues.push("Salary");
  }
  // Intern/Part time/Freelance have no annual leave entitlement (see
  // hasAnnualLeaveEntitlement above), so there's nothing to require here for
  // them.
  if (hasAnnualLeaveEntitlement(employee.employmentType) && (!employee.annualLeaveDays || employee.annualLeaveDays <= 0)) {
    issues.push("Annual leave entitlement");
  }
  if (!employee.startDate) {
    issues.push("Start date");
  }
  return issues;
}

type ManualOnboardingCompletionInput = ContractPrerequisiteInput & {
  surnameEn: string;
  givenNameEn: string;
  hkid: string | null;
  address: string | null;
  birthday: Date | string | null;
  bankName: string | null;
  bankAccount: string | null;
};

/**
 * The mandatory fields for marking an employee's onboarding as complete
 * manually — used to gate that action for employees who were added directly
 * by an admin and never sent an invite link (see the onboarding/complete
 * route). Per the user: HKID, address, surname + given name, birthday,
 * salary, annual leave entitlement, employment type, title, start date, bank
 * account number, and bank name.
 *
 * The title/salary-or-pay-rate/annual-leave/start-date checks are exactly
 * getContractPrerequisiteIssues's own checks (onboardingCompletedAt aside) —
 * reused here rather than duplicated, so a contract is guaranteed
 * creatable the moment onboarding is marked complete this way.
 */
export function getManualOnboardingCompletionIssues(employee: ManualOnboardingCompletionInput): string[] {
  const issues: string[] = [];
  if (!employee.surnameEn?.trim()) issues.push("Surname");
  if (!employee.givenNameEn?.trim()) issues.push("Given name");
  if (!employee.hkid?.trim()) issues.push("HKID");
  if (!employee.address?.trim()) issues.push("Address");
  if (!employee.birthday) issues.push("Date of birth");
  if (!employee.bankName?.trim()) issues.push("Bank name");
  if (!employee.bankAccount?.trim()) issues.push("Bank account number");
  issues.push(...getContractPrerequisiteIssues({ ...employee, onboardingCompletedAt: new Date() }));
  return issues;
}
