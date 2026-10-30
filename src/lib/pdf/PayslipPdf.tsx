/* eslint-disable jsx-a11y/alt-text -- this file's <Image> is @react-pdf/renderer's PDF
   primitive, not an HTML <img> or next/image — it has no `alt` prop to give it. */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { PDF_FONT, PDF_FONT_BOLD } from "@/lib/pdf/font";
import { pdfLanguage, pdfPhrase, websiteWord } from "@/lib/pdf/phrases";

// Same letterhead palette as the other generated PDFs (quotation/invoice/
// recruitment/contract) — keeps every document in the app looking like one
// consistent product rather than a patchwork.
const NAVY = "#1F3864";
const INK = "#111111";
const BORDER = "#000000";

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9,
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 46,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  logo: { width: 130, height: 42, objectFit: "contain" },
  companyName: { fontFamily: PDF_FONT_BOLD, fontWeight: "bold", fontSize: 13, color: NAVY },
  headerMeta: { alignItems: "flex-end" },
  metaTitle: { fontFamily: PDF_FONT_BOLD, fontWeight: "bold", fontSize: 13, color: NAVY, marginBottom: 2 },
  metaLine: { fontSize: 8.5, color: "#555555", marginBottom: 1 },

  section: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FAFAFC",
    marginBottom: 14,
  },
  sectionHeading: {
    backgroundColor: NAVY,
    color: "#FFFFFF",
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 8.5,
    textAlign: "center",
    paddingVertical: 3.5,
  },
  kvRow: {
    flexDirection: "row",
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  kvLabel: { width: 130, fontSize: 9, color: "#444444" },
  kvValue: { flex: 1, fontSize: 9, fontFamily: PDF_FONT_BOLD, fontWeight: "bold" },

  lineRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 0.6,
    borderTopColor: "#DDDDDD",
  },
  lineRowFirst: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  lineLabel: { flex: 1, fontSize: 9 },
  lineValue: { width: 100, fontSize: 9, textAlign: "right" },
  lineTotalRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: "#F0F2F8",
  },
  lineTotalLabel: { flex: 1, fontSize: 9.5, fontFamily: PDF_FONT_BOLD, fontWeight: "bold" },
  lineTotalValue: { width: 100, fontSize: 9.5, fontFamily: PDF_FONT_BOLD, fontWeight: "bold", textAlign: "right" },

  netPayBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: NAVY,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  netPayLabel: { fontFamily: PDF_FONT_BOLD, fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
  netPayValue: { fontFamily: PDF_FONT_BOLD, fontWeight: "bold", fontSize: 15, color: "#FFFFFF" },

  employerNote: { fontSize: 7.5, color: "#666666", lineHeight: 1.5, marginBottom: 14 },
  notesText: { fontSize: 8.5, color: "#333333", lineHeight: 1.5, marginBottom: 14 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 46,
    right: 46,
    textAlign: "center",
  },
  footerText: { fontSize: 8, color: "#33415a" },
  footerBar: { marginTop: 6, height: 4, backgroundColor: NAVY },
});

export type PayslipPdfData = {
  employeeName: string;
  employeeTitle: string;
  employmentTypeLabel: string;
  payBasisLabel: string;
  periodLabel: string;
  rate: number;
  unitsWorked: number;
  unitLabel: string; // "day(s)" | "hour(s)" | ""
  grossPay: number;
  // One-off bonus on top of gross pay — only ever non-zero for Full time
  // employees (see the schema comment on PayrollEntry.bonus). Shown as its
  // own Earnings line only when non-zero.
  bonus: number;
  mpfApplicable: boolean;
  employeeMpf: number;
  employerMpf: number;
  netPay: number;
  notes?: string | null;
  generatedAt: string;
  language?: string | null;
  company: {
    name: string;
    shortName?: string;
    logoData?: string | null;
    address?: string;
    website?: string;
    currency?: string;
    currencyLocale?: string;
  };
};

/** DD/MM/YYYY — the standard date format across every generated document. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function KvRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

const PAYSLIP_LABELS = {
  EN: {
    title: "Payslip",
    payPeriod: "Pay period:",
    generated: "Generated:",
    employee: "Employee",
    name: "Name",
    jobTitle: "Job title",
    employmentType: "Employment type",
    earnings: "Earnings",
    bonus: "Bonus",
    totalEarnings: "Total earnings",
    deductions: "Deductions",
    employeeMpf: "Employee MPF contribution (5%)",
    mpfNa: "MPF — not applicable",
    totalDeductions: "Total deductions",
    netPay: "Net pay",
    notes: "Notes:",
    generatedNote: "This is a computer-generated payslip.",
    employerNote: (amount: string) =>
      `In addition to the deduction above, the Company separately contributes ${amount} to your Mandatory Provident Fund account on your behalf — this employer contribution is not deducted from your pay and is shown here for your records only.`,
  },
  ZH_HANT: {
    title: "薪金單",
    payPeriod: "支薪期：",
    generated: "產生日期：",
    employee: "僱員",
    name: "姓名",
    jobTitle: "職位",
    employmentType: "聘用類型",
    earnings: "入息",
    bonus: "花紅",
    totalEarnings: "入息總額",
    deductions: "扣除",
    employeeMpf: "僱員強積金供款（5%）",
    mpfNa: "強積金 — 不適用",
    totalDeductions: "扣除總額",
    netPay: "淨薪金",
    notes: "備註：",
    generatedNote: "此乃電腦產生的薪金單。",
    employerNote: (amount: string) =>
      `除上述扣除外，本公司另行為閣下的強制性公積金帳戶供款 ${amount}。此僱主供款並非從薪金中扣除，僅供紀錄。`,
  },
  ZH_HANS: {
    title: "薪金单",
    payPeriod: "支薪期：",
    generated: "生成日期：",
    employee: "雇员",
    name: "姓名",
    jobTitle: "职位",
    employmentType: "聘用类型",
    earnings: "入息",
    bonus: "花红",
    totalEarnings: "入息总额",
    deductions: "扣除",
    employeeMpf: "雇员强积金供款（5%）",
    mpfNa: "强积金 — 不适用",
    totalDeductions: "扣除总额",
    netPay: "净薪金",
    notes: "备注：",
    generatedNote: "此乃电脑生成的薪金单。",
    employerNote: (amount: string) =>
      `除上述扣除外，本公司另行为阁下的强制性公积金账户供款 ${amount}。此雇主供款并非从薪金中扣除，仅供记录。`,
  },
} as const;

export function PayslipPdf({ data }: { data: PayslipPdfData }) {
  const t = PAYSLIP_LABELS[pdfLanguage(data.language)];
  const currency = (n: number) =>
    new Intl.NumberFormat(data.company.currencyLocale || "en-HK", {
      style: "currency",
      currency: data.company.currency || "HKD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n || 0);

  const basisLabel = pdfPhrase(data.payBasisLabel, data.language);
  const unitLabel = pdfPhrase(data.unitLabel, data.language);
  const earningsDescription =
    data.payBasisLabel === "Monthly salary" || data.unitLabel === ""
      ? basisLabel
      : `${basisLabel} (${currency(data.rate)} × ${data.unitsWorked} ${unitLabel})`;

  return (
    <Document title={`Payslip - ${data.employeeName} - ${data.periodLabel}`} author={data.company.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {data.company.logoData ? (
            <Image style={styles.logo} src={data.company.logoData} />
          ) : (
            <Text style={styles.companyName}>{data.company.name}</Text>
          )}
          <View style={styles.headerMeta}>
            <Text style={styles.metaTitle}>{t.title}</Text>
            <Text style={styles.metaLine}>{t.payPeriod} {data.periodLabel}</Text>
            <Text style={styles.metaLine}>{t.generated} {formatDate(data.generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.employee}</Text>
          <KvRow label={t.name} value={data.employeeName} />
          <KvRow label={t.jobTitle} value={data.employeeTitle} />
          <KvRow label={t.employmentType} value={pdfPhrase(data.employmentTypeLabel, data.language)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.earnings}</Text>
          <View style={styles.lineRowFirst}>
            <Text style={styles.lineLabel}>{earningsDescription}</Text>
            <Text style={styles.lineValue}>{currency(data.grossPay)}</Text>
          </View>
          {data.bonus ? (
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>{t.bonus}</Text>
              <Text style={styles.lineValue}>{currency(data.bonus)}</Text>
            </View>
          ) : null}
          <View style={styles.lineTotalRow}>
            <Text style={styles.lineTotalLabel}>{t.totalEarnings}</Text>
            <Text style={styles.lineTotalValue}>{currency(data.grossPay + (data.bonus || 0))}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.deductions}</Text>
          {data.mpfApplicable || data.employerMpf > 0 ? (
            <View style={styles.lineRowFirst}>
              <Text style={styles.lineLabel}>{t.employeeMpf}</Text>
              <Text style={styles.lineValue}>{currency(data.employeeMpf)}</Text>
            </View>
          ) : (
            <View style={styles.lineRowFirst}>
              <Text style={styles.lineLabel}>{t.mpfNa}</Text>
              <Text style={styles.lineValue}>{currency(0)}</Text>
            </View>
          )}
          <View style={styles.lineTotalRow}>
            <Text style={styles.lineTotalLabel}>{t.totalDeductions}</Text>
            <Text style={styles.lineTotalValue}>{currency(data.employeeMpf)}</Text>
          </View>
        </View>

        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>{t.netPay}</Text>
          <Text style={styles.netPayValue}>{currency(data.netPay)}</Text>
        </View>

        {(data.mpfApplicable || data.employerMpf > 0) && (
          <Text style={styles.employerNote}>
            {t.employerNote(currency(data.employerMpf))}
          </Text>
        )}

        {data.notes ? <Text style={styles.notesText}>{t.notes} {data.notes}</Text> : null}

        <View style={styles.footer} fixed>
          {data.company.address ? <Text style={styles.footerText}>{data.company.address}</Text> : null}
          {data.company.website ? (
            <Text style={styles.footerText}>{websiteWord(data.language)}: {data.company.website}</Text>
          ) : null}
          <Text style={styles.footerText}>{t.generatedNote}</Text>
          <View style={styles.footerBar} />
        </View>
      </Page>
    </Document>
  );
}
