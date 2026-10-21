export type ThemeMode = "LIGHT" | "DARK" | "AUTO";

export type AppSettings = {
  driveFolderId: string;
  companyName: string;
  companyLogo: string | null;
  companyLogoDark: string | null;
  companyWebsite: string;
  ccEnabled: boolean;
  ccEmails: string;
  animationsEnabled: boolean;
  themeMode: ThemeMode;
  mpfNotificationsEnabled: boolean;
};

export type CustomerDetails = {
  customerName: string;
  customerContact?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
};

export type Multiplier = {
  value: number;
  label: string;
};

export type Fee = {
  label: string;
  amount: number;
};

export type LineItem = {
  id?: string;
  name: string;
  description: string;
  imageData?: string | null; // base64 data URL of an optional product image
  unit: string; // optional unit label, e.g. pcs / hrs / kg — display only
  quantity: number;
  // Zero or more user-added multiplier factors (e.g. "× 3 persons"), freely
  // addable/removable. amount = quantity * unitPrice * product(values).
  multipliers: Multiplier[];
  unitPrice: number;
  amount: number;
  // Free-text, display-only (e.g. "3 hours") — see QuotationItem.duration.
  duration?: string | null;
  // Zero or more named extra charges, freely addable/removable — see
  // QuotationItem.fees.
  fees: Fee[];
  sortOrder?: number;
};

export type PresetItem = {
  id: string;
  name: string;
  description: string;
  imageData?: string | null;
  unit: string;
  multipliers: Multiplier[]; // default factors applied when this preset is added
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
};

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "CONVERTED";
export type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PENDING_VERIFICATION"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type Receipt = {
  id: string;
  number: string;
  invoiceId: string;
  issueDate: string;
  createdAt: string;
  driveFileId?: string | null;
  driveFileUrl?: string | null;
  invoice?: { id: string; number: string; customerName: string; total: number } | null;
};

export type QuotationComment = {
  id: string;
  author: "CLIENT" | "STAFF" | string;
  authorName: string;
  message: string;
  createdAt: string;
};

export type Quotation = CustomerDetails & {
  id: string;
  number: string;
  title: string;
  issueDate: string;
  expiryDate?: string | null;
  status: QuotationStatus;
  notes?: string | null;
  terms?: string | null;
  reminder?: string | null;
  // Which language `terms`/`reminder` (and the generated PDF's static
  // labels) are in — "EN" | "ZH_HANT" | "ZH_HANS". See DocumentLanguage in
  // src/lib/settings.ts.
  language?: string;
  paymentDueDays: number;
  // How many times the whole item list is conducted (e.g. a training run 3
  // times) — multiplies the item subtotal before Discount/Tax. 1 = no
  // repeat. See computeTotals in src/lib/calculations.ts.
  repeatCount: number;
  taxRate: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: LineItem[];
  invoice?: { id: string; number: string } | null;
  comments?: QuotationComment[];
  preparedBy?: string;
  shareMode?: "AMOUNT" | "PERCENT";
  shares?: { id?: string; colleagueName: string; value: number; sortOrder?: number }[];
  signingToken?: string | null;
  signatureData?: string | null;
  signedDocumentData?: string | null; // base64 PDF of an uploaded scanned/printed signed copy
  signedDocumentName?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAt?: string | null;
  signedIp?: string | null;
  driveFolderId?: string | null;
  driveFileId?: string | null;
  driveFileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod: string | null;
  reason: string;
  status: LeaveRequestStatus;
  submittedIp?: string | null;
  decidedAt?: string | null;
  decidedNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeStatus = "ACTIVE" | "ONBOARDING" | "FORMER";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "INTERN" | "FREELANCE";
// Only meaningful for PART_TIME/FREELANCE — see PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE
// in src/lib/employees.ts. FULL_TIME/INTERN use `salary` instead.
export type PayRateType = "DAILY" | "HOURLY" | "PROJECT_FEE";

export type EmployeeContractStatus = "DRAFT" | "SENT" | "SIGNED" | "VERIFIED" | "CANCELLED";

export type EmployeeContract = {
  id: string;
  employeeId: string;
  terms: string;
  probationPeriod?: string | null;
  contractEndDate?: string | null;
  workLocation?: string | null;
  workSchedule?: string | null;
  status: EmployeeContractStatus;
  signingToken?: string | null;
  signerName?: string | null;
  signatureData?: string | null;
  signedAt?: string | null;
  signedIp?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Employee = {
  id: string;
  // Auto-derived from surnameEn/givenNameEn server-side — see
  // src/lib/employees.ts. Kept for every read site (lists, PDFs, emails)
  // that just wants a display name; surnameEn/givenNameEn are the source
  // of truth for anything that needs the parts separately (e.g. IR56B).
  name: string;
  surnameEn: string;
  givenNameEn: string;
  // What they go by day to day — shown on the Employees list instead of the
  // full name when set. Everywhere else keeps using `name`.
  preferredName?: string | null;
  nickname?: string | null;
  companyId?: string | null;
  title: string;
  salary: number;
  payRateType?: PayRateType | null;
  payRate: number;
  annualLeaveDays: number;
  startDate?: string | null;
  hkid?: string | null;
  address?: string | null;
  gender?: string | null;
  birthday?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankCardName?: string | null;
  lastDay?: string | null;
  leavingReason?: string | null;
  status: EmployeeStatus;
  employmentType?: EmploymentType | null;
  contract?: EmployeeContract | null;
  leaveToken?: string | null;
  companyEmail?: string | null;
  email?: string | null;
  onboardingToken?: string | null;
  onboardingSentAt?: string | null;
  onboardingCompletedAt?: string | null;
  nameChinese?: string | null;
  surnameChinese?: string | null;
  givenNameChinese?: string | null;
  nationality?: string | null;
  phone?: string | null;
  personalEmail?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  bankCode?: string | null;
  leaveRequests?: LeaveRequest[];
  pendingLeaveCount?: number;
  createdAt: string;
  updatedAt: string;
};

// A calendar entry, created via "Mark on Calendar" on an invoice — see
// src/lib/events.ts and the Event model in schema.prisma. The only kind of
// row the Calendar page shows.
export type Event = {
  id: string;
  invoiceId: string;
  name: string;
  startDate: string;
  startTime?: string | null;
  endDate: string;
  endTime?: string | null;
  durationMins: number;
  contactPerson?: string | null;
  companyName: string;
  createdAt: string;
  updatedAt: string;
};

export type PayrollRunStatus = "DRAFT" | "FINALIZED";
export type PayBasis = "SALARY" | "DAILY" | "HOURLY" | "PROJECT_FEE";

export type PayrollEntry = {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  employeeTitle: string;
  employeeEmail?: string | null;
  employmentType?: EmploymentType | null;
  payBasis: PayBasis;
  rate: number;
  unitsWorked: number;
  grossPay: number;
  // One-off bonus on top of gross pay, folded into netPay — only ever
  // non-zero for Full time employees. See the schema comment on
  // PayrollEntry.bonus in prisma/schema.prisma.
  bonus: number;
  mpfApplicable: boolean;
  employeeMpf: number;
  employerMpf: number;
  netPay: number;
  notes?: string | null;
  payslipSentAt?: string | null;
  driveFileId?: string | null;
  driveFileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollRun = {
  id: string;
  period: string; // "YYYY-MM"
  status: PayrollRunStatus;
  entries: PayrollEntry[];
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollRunSummary = {
  id: string;
  period: string;
  status: PayrollRunStatus;
  finalizedAt?: string | null;
  createdAt: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
};

export type Invoice = CustomerDetails & {
  id: string;
  number: string;
  title: string;
  poNumber?: string | null;
  quotationId?: string | null;
  quotation?: { id: string; number: string } | null;
  issueDate: string;
  dueDate?: string | null;
  // Event date/time this invoice is for — moved here from Quotation. Filled
  // in manually after the invoice already exists; see the Invoice model
  // comment in schema.prisma. `event` (once created via "Mark on Calendar")
  // is fetched separately (see lib/events.ts) rather than included here.
  eventStartDate?: string | null;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  status: InvoiceStatus;
  paidAt?: string | null; // when the invoice actually became PAID — basis for monthly revenue
  notes?: string | null;
  terms?: string | null;
  reminder?: string | null;
  // See Quotation.language for the full explanation.
  language?: string;
  paymentDueDays: number;
  signatureData?: string | null;
  signatureName?: string | null;
  signedAt?: string | null;
  taxRate: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: LineItem[];
  expenses?: { id: string; category: string; label: string; amount: number }[]; // internal-only, never on the PDF
  viewToken?: string | null;
  paymentSubmittedAt?: string | null;
  paymentSubmittedName?: string | null;
  paymentSubmittedEmail?: string | null;
  receipt?: { id: string; number: string } | null;
  driveFolderId?: string | null;
  driveFileId?: string | null;
  driveFileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};
