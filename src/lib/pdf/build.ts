import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { DocumentPdf, PdfDocData } from "@/lib/pdf/DocumentPdf";
import { RecruitmentAgreementPdf, RecruitmentAgreementPdfData } from "@/lib/pdf/RecruitmentAgreementPdf";
import { EmployeeContractPdf, EmployeeContractPdfData } from "@/lib/pdf/EmployeeContractPdf";
import { PayslipPdf, PayslipPdfData } from "@/lib/pdf/PayslipPdf";
import { SalaryReportPdf, SalaryReportPdfData } from "@/lib/pdf/SalaryReportPdf";
import { fillIR56BTemplate, titleCheckboxesFor, parseHkid, ddmmyyyy } from "@/lib/pdf/ir56bFill";
import { getEffectiveCompany } from "@/lib/appSettings";
import { normalizeMultipliers } from "@/lib/multipliers";
import { normalizeFees } from "@/lib/fees";
import { PAY_BASIS_LABELS, PAY_BASIS_UNIT_LABELS, periodLabel } from "@/lib/payroll";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/employees";
import { greetingName, contractDocumentTitleFor } from "@/lib/employeeContractTerms";
import { computeTotals } from "@/lib/calculations";
import { standardReminderForLanguage, standardTermsForLanguage } from "@/lib/settings";
import {
  buildFeeScaleTables,
  DEFAULT_FEE_SCALE_CONTRACT,
  DEFAULT_FEE_SCALE_PERMANENT,
  normalizeFeeScaleRows,
  RECRUITMENT_TERMS_TEMPLATES,
  renderRecruitmentTerms,
  VALID_RECRUITMENT_LANGUAGES,
  type RecruitmentLanguage,
} from "@/lib/recruitmentTerms";

type Built = {
  data: PdfDocData;
  buffer: Buffer;
  number: string;
  customerName: string;
  customerEmail: string | null;
};

function mapItems(items: any[]) {
  return items.map((i) => ({
    name: i.name,
    description: i.description,
    imageData: i.imageData,
    unit: i.unit,
    quantity: i.quantity,
    multipliers: normalizeMultipliers(i.multipliers),
    unitPrice: i.unitPrice,
    amount: i.amount,
    duration: i.duration,
    fees: normalizeFees(i.fees),
  }));
}

async function render(data: PdfDocData): Promise<Buffer> {
  return renderToBuffer(React.createElement(DocumentPdf, { data }) as React.ReactElement);
}

function sameText(a?: string | null, b?: string | null): boolean {
  return (a || "").replace(/\r\n/g, "\n").trim() === (b || "").replace(/\r\n/g, "\n").trim();
}

function asRecruitmentLanguage(value?: string | null): RecruitmentLanguage {
  return VALID_RECRUITMENT_LANGUAGES.includes(value as RecruitmentLanguage)
    ? (value as RecruitmentLanguage)
    : "EN";
}

/** Re-render a recruitment agreement's standard terms in another language.
 *  Hand-edited clause text is left as stored. */
function recruitmentTermsForLanguage(
  agreement: {
    terms: string;
    language: string;
    companyName: string;
    paymentDueDays: number;
    feeScalePermanent: string;
    feeScaleContract: string;
  },
  override?: string | null
): string {
  if (!override) return agreement.terms;
  const target = asRecruitmentLanguage(override);
  const rows = {
    permanent: normalizeFeeScaleRows(agreement.feeScalePermanent, DEFAULT_FEE_SCALE_PERMANENT),
    contract: normalizeFeeScaleRows(agreement.feeScaleContract, DEFAULT_FEE_SCALE_CONTRACT),
  };
  const matchesStandard = VALID_RECRUITMENT_LANGUAGES.some((lang) =>
    sameText(
      agreement.terms,
      renderRecruitmentTerms(
        RECRUITMENT_TERMS_TEMPLATES[lang],
        agreement.companyName,
        agreement.paymentDueDays,
        buildFeeScaleTables(rows, lang)
      )
    )
  );
  if (!matchesStandard) return agreement.terms;
  return renderRecruitmentTerms(
    RECRUITMENT_TERMS_TEMPLATES[target],
    agreement.companyName,
    agreement.paymentDueDays,
    buildFeeScaleTables(rows, target)
  );
}

/** Build the PDF (and its data) for a quotation. Returns null if not found.
 *  `languageOverride` changes this file only — it is not saved on the quotation. */
export async function buildQuotationPdf(id: string, languageOverride?: string | null): Promise<Built | null> {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      invoice: { select: { id: true, number: true } },
    },
  });
  if (!quotation) return null;

  const company = await getEffectiveCompany(quotation.companyId);
  const items = mapItems(quotation.items);
  const data: PdfDocData = {
    kind: "Quotation",
    number: quotation.number,
    title: quotation.title,
    status: quotation.status,
    issueDate: quotation.issueDate.toISOString(),
    secondaryDateLabel: "Valid Until",
    secondaryDate: quotation.expiryDate ? quotation.expiryDate.toISOString() : null,
    customer: {
      name: quotation.customerName,
      contact: quotation.customerContact,
      email: quotation.customerEmail,
      phone: quotation.customerPhone,
      address: quotation.customerAddress,
    },
    items,
    subtotal: quotation.subtotal,
    repeatCount: quotation.repeatCount,
    rawSubtotal: computeTotals(items, quotation.taxRate, quotation.discount, quotation.repeatCount)
      .rawSubtotal,
    discount: quotation.discount,
    taxRate: quotation.taxRate,
    taxAmount: quotation.taxAmount,
    total: quotation.total,
    paymentDueDays: quotation.paymentDueDays,
    notes: quotation.notes,
    terms: standardTermsForLanguage(quotation.terms, quotation.paymentDueDays, languageOverride),
    reminder: standardReminderForLanguage(quotation.reminder, languageOverride),
    language: languageOverride || quotation.language,
    signatureData: quotation.signatureData,
    signatureName: quotation.signerName,
    signedAt: quotation.signedAt ? quotation.signedAt.toISOString() : null,
    signedViaUpload: Boolean(quotation.signedDocumentData),
    relatedLabel: quotation.invoice
      ? `Converted to Invoice ${quotation.invoice.number}`
      : undefined,
    company,
  };

  return {
    data,
    buffer: await render(data),
    number: quotation.number,
    customerName: quotation.customerName,
    customerEmail: quotation.customerEmail,
  };
}

/** Build the PDF (and its data) for an invoice. Returns null if not found.
 *  `languageOverride` changes only this file's headings and standard wording.
 *  It is not written back to the invoice. */
export async function buildInvoicePdf(
  id: string,
  languageOverride?: string | null
): Promise<Built | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      quotation: { select: { id: true, number: true } },
    },
  });
  if (!invoice) return null;

  const company = await getEffectiveCompany(invoice.companyId);
  const data: PdfDocData = {
    kind: "Invoice",
    number: invoice.number,
    title: invoice.title,
    poNumber: invoice.poNumber,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    secondaryDateLabel: "Due Date",
    secondaryDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    customer: {
      name: invoice.customerName,
      contact: invoice.customerContact,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
    },
    items: mapItems(invoice.items),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    paymentDueDays: invoice.paymentDueDays,
    notes: invoice.notes,
    terms: standardTermsForLanguage(invoice.terms, invoice.paymentDueDays, languageOverride),
    reminder: standardReminderForLanguage(invoice.reminder, languageOverride),
    language: languageOverride || invoice.language,
    signatureData: invoice.signatureData,
    signatureName: invoice.signatureName,
    signedAt: invoice.signedAt ? invoice.signedAt.toISOString() : null,
    relatedLabel: invoice.quotation
      ? `Converted from Quotation ${invoice.quotation.number}`
      : undefined,
    company,
  };

  return {
    data,
    buffer: await render(data),
    number: invoice.number,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
  };
}

/** Build the PDF (and its data) for a receipt. Returns null if not found.
 *  `languageOverride` changes this file only — it is not saved on the invoice. */
export async function buildReceiptPdf(invoiceId: string, languageOverride?: string | null): Promise<Built | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      receipt: true,
    },
  });
  if (!invoice || !invoice.receipt) return null;

  const company = await getEffectiveCompany(invoice.companyId);
  const data: PdfDocData = {
    kind: "Receipt",
    number: invoice.receipt.number,
    invoiceNumber: invoice.number,
    status: invoice.status,
    issueDate: invoice.receipt.issueDate.toISOString(),
    secondaryDateLabel: "",
    secondaryDate: null,
    customer: {
      name: invoice.customerName,
      contact: invoice.customerContact,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
    },
    items: mapItems(invoice.items),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    paymentDueDays: invoice.paymentDueDays,
    notes: null,
    terms: null,
    reminder: null,
    // Receipt has no language column of its own (see the schema comment on
    // Receipt) — it simply inherits its parent invoice's language when
    // rendered, unless this download asked for a different language.
    language: languageOverride || invoice.language,
    company,
  };

  return {
    data,
    buffer: await render(data),
    number: invoice.receipt.number,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
  };
}

type BuiltRecruitment = {
  data: RecruitmentAgreementPdfData;
  buffer: Buffer;
  number: string;
  companyName: string;
  companyEmail: string | null;
};

/** Build the PDF (and its data) for a recruitment agreement. Returns null if not found.
 *  `languageOverride` changes this file only — it is not saved on the agreement. */
export async function buildRecruitmentAgreementPdf(
  id: string,
  languageOverride?: string | null
): Promise<BuiltRecruitment | null> {
  const agreement = await prisma.recruitmentAgreement.findUnique({ where: { id } });
  if (!agreement) return null;

  const company = await getEffectiveCompany(agreement.companyId);
  const data: RecruitmentAgreementPdfData = {
    number: agreement.number,
    companyName: agreement.companyName,
    companyEmail: agreement.companyEmail,
    status: agreement.status,
    createdAt: agreement.createdAt.toISOString(),
    terms: recruitmentTermsForLanguage(agreement, languageOverride),
    language: languageOverride || agreement.language,
    signerName: agreement.signerName,
    signerCompanyName: agreement.signerCompanyName,
    signerJobTitle: agreement.signerJobTitle,
    signatureData: agreement.signatureData,
    signedViaUpload: Boolean(agreement.signedDocumentData),
    signedAt: agreement.signedAt ? agreement.signedAt.toISOString() : null,
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      address: company.address,
      website: company.website,
      chopData: company.chopData,
      agentSignerName: company.agentSignerName,
      agentSignerTitle: company.agentSignerTitle,
      agentSignatureData: company.agentSignatureData,
    },
  };

  const buffer = await renderToBuffer(
    React.createElement(RecruitmentAgreementPdf, { data }) as React.ReactElement
  );

  return {
    data,
    buffer,
    number: agreement.number,
    companyName: agreement.companyName,
    companyEmail: agreement.companyEmail,
  };
}

type BuiltEmployeeContract = {
  data: EmployeeContractPdfData;
  buffer: Buffer;
  employeeName: string;
  employeeEmail: string | null;
};

/** Build the PDF (and its data) for an employee's contract letter. Returns
 *  null if the employee or its contract doesn't exist.
 *  `languageOverride` changes the letterhead and signature labels only.
 *  The clause text stays as stored — there is no second saved copy. */
export async function buildEmployeeContractPdf(
  employeeId: string,
  languageOverride?: string | null
): Promise<BuiltEmployeeContract | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { contract: true },
  });
  if (!employee || !employee.contract) return null;

  const contract = employee.contract;
  const company = await getEffectiveCompany();
  const data: EmployeeContractPdfData = {
    employeeName: employee.name,
    greetingName: greetingName(employee.name, employee.gender),
    hkid: employee.hkid,
    status: contract.status,
    createdAt: contract.createdAt.toISOString(),
    terms: contract.terms,
    documentTitle: contractDocumentTitleFor(employee.employmentType),
    language: languageOverride,
    signerName: contract.signerName,
    employeeTitle: employee.title,
    signatureData: contract.signatureData,
    signedViaUpload: Boolean(contract.signedDocumentData),
    signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      address: company.address,
      website: company.website,
      chopData: company.chopData,
      agentSignerName: company.agentSignerName,
      agentSignerTitle: company.agentSignerTitle,
      agentSignatureData: company.agentSignatureData,
    },
  };

  const buffer = await renderToBuffer(
    React.createElement(EmployeeContractPdf, { data }) as React.ReactElement
  );

  return {
    data,
    buffer,
    employeeName: employee.name,
    employeeEmail: employee.personalEmail || employee.email,
  };
}

type BuiltPayslip = {
  data: PayslipPdfData;
  buffer: Buffer;
  employeeName: string;
  employeeEmail: string | null;
  periodLabel: string;
};

/** Build the payslip PDF for one entry within a payroll run. Returns null if
 *  the entry (or its parent run) doesn't exist. */
export async function buildPayslipPdf(
  runId: string,
  entryId: string,
  languageOverride?: string | null
): Promise<BuiltPayslip | null> {
  const entry = await prisma.payrollEntry.findUnique({
    where: { id: entryId },
    include: { run: true, employee: true },
  });
  if (!entry || entry.runId !== runId) return null;

  const company = await getEffectiveCompany();
  const period = periodLabel(entry.run.period, languageOverride);
  const data: PayslipPdfData = {
    employeeName: entry.employeeName,
    employeeTitle: entry.employeeTitle,
    employmentTypeLabel: EMPLOYMENT_TYPE_LABELS[entry.employmentType || ""] || "—",
    payBasisLabel: PAY_BASIS_LABELS[entry.payBasis] || entry.payBasis,
    periodLabel: period,
    rate: entry.rate,
    unitsWorked: entry.unitsWorked,
    unitLabel: PAY_BASIS_UNIT_LABELS[entry.payBasis] || "",
    grossPay: entry.grossPay,
    bonus: entry.bonus,
    mpfApplicable: entry.mpfApplicable,
    employeeMpf: entry.employeeMpf,
    employerMpf: entry.employerMpf,
    netPay: entry.netPay,
    notes: entry.notes,
    generatedAt: new Date().toISOString(),
    language: languageOverride,
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      address: company.address,
      website: company.website,
      currency: company.currency,
      currencyLocale: company.currencyLocale,
    },
  };

  const buffer = await renderToBuffer(React.createElement(PayslipPdf, { data }) as React.ReactElement);

  return {
    data,
    buffer,
    employeeName: entry.employeeName,
    employeeEmail: entry.employee.personalEmail || entry.employee.email || entry.employee.companyEmail,
    periodLabel: period,
  };
}

type BuiltSalaryReport = {
  data: SalaryReportPdfData;
  buffer: Buffer;
  employeeName: string;
};

/**
 * Build a salary report PDF for one employee across every payroll run whose
 * period falls within [from, to] (both "YYYY-MM", inclusive) — one row per
 * period plus a totals row, covering income (gross pay), bonus, and both
 * sides of MPF. "YYYY-MM" strings sort/compare correctly as plain strings,
 * so no date parsing is needed for the range filter. Returns null only if
 * the employee itself doesn't exist; an employee with no entries in range
 * still gets a report (an empty table with a note — see SalaryReportPdf).
 */
export async function buildSalaryReportPdf(
  employeeId: string,
  from: string,
  to: string,
  languageOverride?: string | null
): Promise<BuiltSalaryReport | null> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const entries = await prisma.payrollEntry.findMany({
    where: { employeeId, run: { period: { gte: from, lte: to } } },
    include: { run: true },
    orderBy: { run: { period: "asc" } },
  });

  const company = await getEffectiveCompany();

  const rows = entries.map((entry) => ({
    periodLabel: periodLabel(entry.run.period, languageOverride),
    payBasisLabel: PAY_BASIS_LABELS[entry.payBasis] || entry.payBasis,
    grossPay: entry.grossPay,
    bonus: entry.bonus,
    employeeMpf: entry.employeeMpf,
    employerMpf: entry.employerMpf,
    netPay: entry.netPay,
  }));

  const totals = rows.reduce(
    (sum, r) => ({
      grossPay: sum.grossPay + r.grossPay,
      bonus: sum.bonus + r.bonus,
      employeeMpf: sum.employeeMpf + r.employeeMpf,
      employerMpf: sum.employerMpf + r.employerMpf,
      netPay: sum.netPay + r.netPay,
    }),
    { grossPay: 0, bonus: 0, employeeMpf: 0, employerMpf: 0, netPay: 0 }
  );

  const data: SalaryReportPdfData = {
    employeeName: employee.name,
    employeeTitle: employee.title,
    employmentTypeLabel: EMPLOYMENT_TYPE_LABELS[employee.employmentType || ""] || "—",
    fromLabel: periodLabel(from, languageOverride),
    toLabel: periodLabel(to, languageOverride),
    language: languageOverride,
    rows,
    totals,
    generatedAt: new Date().toISOString(),
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      address: company.address,
      website: company.website,
      currency: company.currency,
      currencyLocale: company.currencyLocale,
    },
  };

  const buffer = await renderToBuffer(React.createElement(SalaryReportPdf, { data }) as React.ReactElement);

  return { data, buffer, employeeName: employee.name };
}

type BuiltIR56B = {
  buffer: Buffer;
  employeeName: string;
};

/**
 * Fill the REAL official IR56B PDF (src/lib/pdf/templates/IR56B.pdf — its
 * own AcroForm fields, not a react-pdf replica — see ir56bFill.ts) for one
 * employee for the HK tax year ending 31 March `taxYearEndYear` (e.g. 2026
 * = 1 Apr 2025 – 31 Mar 2026). Income lines (a) Salary/wages and (e) Bonus
 * are auto-totaled from every finalized PayrollEntry whose run falls in
 * that window — every other line (director's fee, commission, leave pay,
 * back pay, etc.) is left at 0 since this app has no separate tracking for
 * them; the employer can add those manually before filing. See the "IR56B
 * fields" comment on the Employee model in schema.prisma for the fuller
 * picture of what is/isn't captured — marital status, spouse, passport,
 * correspondence address, housing benefit, employer file number, and
 * non-HK-entity payment details were all deliberately removed rather than
 * stored, so those boxes are always left blank on the generated form.
 */
export async function buildIR56BPdf(employeeId: string, taxYearEndYear: number): Promise<BuiltIR56B | null> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const periodFrom = `${taxYearEndYear - 1}-04`;
  const periodTo = `${taxYearEndYear}-03`;
  const taxYearStart = new Date(taxYearEndYear - 1, 3, 1); // 1 April
  const taxYearEnd = new Date(taxYearEndYear, 2, 31); // 31 March

  const empStart: Date | null = employee.startDate ? new Date(employee.startDate) : null;
  const empEnd: Date | null = employee.lastDay ? new Date(employee.lastDay) : null;
  const employmentPeriodFrom = empStart && empStart > taxYearStart ? empStart : taxYearStart;
  const employmentPeriodTo = empEnd && empEnd < taxYearEnd ? empEnd : taxYearEnd;

  const entries = await prisma.payrollEntry.findMany({
    where: { employeeId, run: { period: { gte: periodFrom, lte: periodTo } } },
  });
  const totalGrossPay = entries.reduce((sum, e) => sum + e.grossPay, 0);
  const totalBonus = entries.reduce((sum, e) => sum + e.bonus, 0);
  const totalAmount = totalGrossPay + totalBonus;

  const company = await getEffectiveCompany();
  const hkid = parseHkid(employee.hkid);

  // Amounts are whole HKD, no thousands separators or decimals — matches
  // the sample form's own "300000" style (the boxes are individual-digit
  // grids, not a formatted currency field).
  const wholeAmount = (n: number) => String(Math.round(n));

  const buffer = await fillIR56BTemplate({
    reportingYear: String(taxYearEndYear),
    nameOfEmployer: company.name,
    sheetNumber: "1",
    ...titleCheckboxesFor(employee.gender),
    chineseSurname: employee.surnameChinese || "",
    chineseGivenName: employee.givenNameChinese || "",
    englishSurname: employee.surnameEn,
    englishGivenName: employee.givenNameEn,
    hkidPrefix: hkid.prefix,
    hkidDigits: hkid.digits,
    hkidCheckDigit: hkid.checkDigit,
    sex: employee.gender === "Male" ? "M" : employee.gender === "Female" ? "F" : "",
    residentialAddress: employee.address || "",
    capacityEngaged: employee.title || "",
    // Period columns for each income line match the overall employment
    // period below — left blank alongside the amount when there's nothing
    // to report for that line (e.g. no bonus paid this year).
    salaryStartDate: totalGrossPay ? ddmmyyyy(employmentPeriodFrom) : "",
    salaryEndDate: totalGrossPay ? ddmmyyyy(employmentPeriodTo) : "",
    amountSalaryWages: totalGrossPay ? wholeAmount(totalGrossPay) : "",
    bonusStartDate: totalBonus ? ddmmyyyy(employmentPeriodFrom) : "",
    bonusEndDate: totalBonus ? ddmmyyyy(employmentPeriodTo) : "",
    amountBonus: totalBonus ? wholeAmount(totalBonus) : "",
    amountTotalIncomes: wholeAmount(totalAmount),
    // Housing-benefit and non-HK-entity payment details were deliberately
    // removed from the Employee model (see schema.prisma) — always "0"
    // (not applicable) rather than guessing.
    placeOfResidenceProvided: "0",
    sumPaidByNonHkCompany: "0",
    startDate: ddmmyyyy(employmentPeriodFrom),
    endDate: ddmmyyyy(employmentPeriodTo),
    // Bottom-center declaration block — the company's authorized signer,
    // same person the Recruitment Agreement PDF signs as on HR Plus's
    // behalf — and today's date (when this form is generated/filed).
    nameOfSigner: company.agentSignerName || "",
    designation: company.agentSignerTitle || "",
    dateOfSigning: ddmmyyyy(new Date()),
  });

  return { buffer: Buffer.from(buffer), employeeName: employee.name };
}
