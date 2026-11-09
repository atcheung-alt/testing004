/* eslint-disable jsx-a11y/alt-text -- this file's <Image> is @react-pdf/renderer's PDF
   primitive, not an HTML <img> or next/image — it has no `alt` prop to give it. */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { PDF_FONT, PDF_FONT_BOLD } from "@/lib/pdf/font";
import { lineTotalWithFee } from "@/lib/calculations";


// Palette matching the HR Plus quotation format
const NAVY = "#1F3864";
const INK = "#111111";
const BORDER = "#000000";

// Whether a line-item row is allowed to split across a page break at all.
// This sounds like it should always be "yes" (see the `tableRow`/`cell`
// style comments below on why forcing every row to stay atomic caused a
// stretched-blank-page bug for long descriptions), but plain "always
// splittable" has its own failure mode: if a row happens to start in a
// sliver of leftover space too small for even its first line, react-pdf
// resolves that shortage inconsistently across the row's cells — one cell
// renders anyway (overflowing past the page's printable area, into the
// footer) while its siblings sit out that page entirely and reappear,
// disconnected, once the row properly resumes on the next page. A tried
// `minPresenceAhead` (react-pdf's built-in "don't start unless N points are
// free" prop) to fix that directly, but it back-fired on genuinely long
// rows: once a row is already going to split across pages, react-pdf's
// pagination sometimes decides none of it can go on the current page at
// all and defers the *entire* multi-hundred-point row, leaving a
// conspicuously blank gap above it — worse than the bug it was meant to fix.
//
// So the two failure modes need two different tools: a row short enough to
// always fit on a single page doesn't need to split at all — `wrap={false}`
// on it means react-pdf either places it whole or (if it doesn't fit here)
// defers the whole thing to the next page, which is exactly the atomic
// behavior that avoids the sliver-start bug. A row long enough that it
// might exceed a full page needs to remain splittable, since forcing *that*
// one atomic is what caused the original stretched-page bug. `rowFitsOnOnePage`
// below estimates which case a given item falls into from its description
// length, so each row gets whichever behavior is actually safe for it.
// 12, not 20: CJK and a no-space measurement string wrap tighter than one
// Latin character per 20. An atomic row (wrap={false}) that is actually
// taller than one page is what stops the PDF from generating. 12 keeps a
// normal short description on one page, and lets a long one continue.
const TABLE_DESC_CHARS_PER_LINE = 12;
const TABLE_ROW_MAX_SAFE_LINES = 34; // ~34 lines comfortably fits within a full page even if the row doesn't start at the very top

function estimatedDescLineCount(item: { description?: string | null; fees?: { label: string; amount: number }[] }): number {
  const segments = (item.description || "").split("\n");
  const lines = segments.reduce(
    (sum, seg) => sum + Math.max(1, Math.ceil(seg.length / TABLE_DESC_CHARS_PER_LINE)),
    0
  );
  return lines + (item.fees?.length || 0);
}

/** True when an item's description is short enough that its row is never
 *  going to need to span a page break — see the comment above `tableRow`. */
function rowFitsOnOnePage(item: { description?: string | null; fees?: { label: string; amount: number }[] }): boolean {
  return estimatedDescLineCount(item) <= TABLE_ROW_MAX_SAFE_LINES;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 8.5,
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 46,
  },
  logoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  logo: {
    width: 128,
    objectFit: "contain",
  },
  brandNameFallback: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 18,
    color: NAVY,
  },

  // "Quotation | <title>" bar
  titleBar: {
    flexDirection: "row",
    borderWidth: 1.2,
    borderColor: BORDER,
    marginBottom: 14,
  },
  titleKind: {
    backgroundColor: NAVY,
    color: "#FFFFFF",
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 11,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  titleText: {
    flex: 1,
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 11,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 1.2,
    borderLeftColor: BORDER,
  },

  // Generic bordered section with a navy heading bar. A faint fill (rather
  // than relying on the border alone) keeps a section looking like one
  // continuous box if it's long enough to span a page break — react-pdf
  // always drops the border exactly at the split point (by design, so a
  // split box doesn't get a false "closing" line), which reads as the box
  // being cut off if the fill is plain white. Actual per-clause "can this
  // legally be split here" is handled separately with wrap={false}, below.
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
    paddingHorizontal: 6,
  },
  kvLabel: {
    width: 110,
    fontSize: 8.5,
  },
  kvValue: {
    flex: 1,
    fontSize: 8.5,
  },
  sectionBody: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  sectionText: {
    fontSize: 8,
    lineHeight: 1.5,
  },
  termClause: {
    marginBottom: 6,
  },
  termHeading: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 8,
    lineHeight: 1.5,
    marginBottom: 1,
  },
  termParagraph: {
    fontSize: 8,
    lineHeight: 1.5,
  },
  termBullet: {
    fontSize: 8,
    lineHeight: 1.5,
    marginLeft: 10,
  },
  termSubBullet: {
    fontSize: 8,
    lineHeight: 1.5,
    marginLeft: 22,
  },

  // Items table
  table: {
    borderWidth: 1.2,
    borderColor: BORDER,
    marginBottom: 14,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: NAVY,
  },
  th: {
    color: "#FFFFFF",
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 8,
    textAlign: "center",
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderRightWidth: 0.8,
    borderRightColor: "#FFFFFF",
  },
  // Deliberately no `wrap={false}` on item rows (the map() below, and its
  // twins in the invoice/receipt tables) — a row with a long description can
  // be taller than a whole page, and telling react-pdf it's unsplittable
  // forces the entire row onto a fresh page, where its bordered cells still
  // stretch to the row's full computed height, leaving a mostly-blank boxed
  // page above the next row. Letting it wrap naturally splits the row across
  // the page boundary instead — the borderTop-only style here means there's
  // no bottom edge to look "orphaned" when that happens, same reasoning as
  // `.section` above.
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderTopColor: BORDER,
  },
  // justifyContent: "flex-start" (not "center") is load-bearing, not a
  // style choice. Every cell in a row gets stretched to match the row's
  // tallest cell (the description, via flexbox's default cross-axis
  // stretch) — for a normal short row that's only a few points taller than
  // its neighbors, so centering looked fine. But when a description is long
  // enough to span a page break, react-pdf computes each cell's "centered"
  // position against that full, un-split height and places it wherever that
  // falls — which can be on a completely different page fragment than where
  // the row (and its description) actually starts, since short sibling
  // cells (item name, price, qty, the reference thumbnail) don't scale with
  // the description and can land oddly to one side of the split. Anchoring
  // every cell to the top instead means its content always renders where
  // the row itself begins, never orphaned onto a later fragment.
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderRightWidth: 0.8,
    borderRightColor: BORDER,
    justifyContent: "flex-start",
  },
  // Item was 13% — too narrow for anything longer than a one-word name
  // (e.g. "Gacha Machine (Non-Customizable)" would wrap onto several lines
  // right up against its own column border). Widened to 17%, taken evenly
  // from the columns with the least to lose: Pricing/Quantity/Duration are
  // short numeric/label values, and Reference only ever holds a fixed
  // 52pt-wide thumbnail, so none of them needed their original share.
  colItem: { width: "17%" },
  colDesc: { width: "25%" },
  colPricing: { width: "11%" },
  colQty: { width: "11%" },
  colDuration: { width: "9%" },
  colRef: { width: "12%" },
  colPrice: { width: "15%", borderRightWidth: 0 },
  itemName: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 8,
    textAlign: "center",
  },
  descText: {
    fontSize: 8,
    lineHeight: 1.45,
  },
  // No fontStyle: "italic" here — @react-pdf/renderer resolves italic by
  // looking for a registered italic face of the current font family, and
  // NotoSansSC (see src/lib/pdf/font.ts) only has "normal"/"bold" faces
  // registered (there's no real italic instance for the variable font this
  // was built from). Requesting italic threw "Could not resolve font for
  // NotoSansSC, fontWeight 400" and crashed the whole PDF render — which is
  // exactly why the download broke as soon as an item had an additional
  // fee (this Text only renders when `item.fees` is non-empty). The grey
  // color + smaller size already distinguish this line from the item
  // description without needing italics.
  feeText: {
    fontSize: 7.5,
    lineHeight: 1.45,
    color: "#555555",
    marginTop: 2,
  },
  centerText: {
    fontSize: 8,
    textAlign: "center",
  },
  refImage: {
    width: 52,
    height: 38,
    objectFit: "cover",
    alignSelf: "center",
  },
  totalsRow: {
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderTopColor: BORDER,
  },
  // Applied on top of colDuration only inside <TotalsSpacer />'s last
  // box — see the comment there for why this can't just live on
  // colDuration itself.
  totalsSpacerDivider: {
    borderRightWidth: 0.8,
    borderRightColor: BORDER,
  },
  // totalsLabelCell/totalsValueCell match colRef/colPrice's widths exactly
  // (12%/15%) so their borders land on the item table's column borders
  // above instead of cutting across the middle of a column. The gap to
  // their left is filled by <TotalsSpacer /> — seeing colItem/colDesc/
  // colPricing/colQty/colDuration's actual boxes again there (rather than
  // one box sized to their 73% sum) so the layout engine accumulates the
  // exact same rounding it used for the item row above, with no risk of a
  // sub-pixel drift between "5 boxes summing to 73%" and "1 box at 73%".
  totalsLabelCell: {
    width: "12%",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRightWidth: 0.8,
    borderRightColor: BORDER,
    justifyContent: "center",
  },
  // No border here — matches colPrice, the rightmost item column, which
  // is explicitly borderless on its right edge for the same reason
  // (nothing further right for it to divide from).
  totalsValueCell: {
    width: "15%",
    paddingVertical: 4,
    paddingHorizontal: 5,
    justifyContent: "center",
  },
  totalsLabel: {
    fontSize: 8,
    textAlign: "right",
  },
  totalsValue: {
    fontSize: 8,
    textAlign: "right",
  },
  grandLabel: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 8.5,
    textAlign: "right",
  },
  grandValue: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 8.5,
    textAlign: "right",
  },

  // Signature block
  signRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  chopBlock: {
    width: 170,
  },
  chopImage: {
    width: 90,
    height: 89,
    objectFit: "contain",
    marginTop: 6,
  },
  signBlock: {
    width: 250,
  },
  signText: {
    fontSize: 8.5,
    marginBottom: 2,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    height: 46,
    marginBottom: 4,
  },
  signImage: {
    maxHeight: 44,
    maxWidth: 200,
    objectFit: "contain",
    marginBottom: 2,
  },
  signImageBox: {
    height: 46,
    justifyContent: "flex-end",
    marginBottom: 4,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 46,
    right: 46,
    textAlign: "center",
    fontSize: 7,
    color: "#888888",
  },
});

/** DD/MM/YYYY — the standard date format across every generated document. */
const formatDateShort = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
};

type TermLine = { text: string; bullet: boolean; indent: 0 | 1 };
type TermClause = { heading: string | null; lines: TermLine[] };

/**
 * Parses the freeform Terms & Conditions text into clauses so the PDF can
 * bold "N. Heading" lines and indent "- " / "  - " lines as bullets, while
 * the underlying field stays a plain, user-editable text block.
 */
function parseTermsClauses(text: string): TermClause[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const rawLines = block.split("\n");
      let heading: string | null = null;
      let bodyLines = rawLines;
      if (/^\d+\.\s+\S/.test(rawLines[0])) {
        heading = rawLines[0].trim();
        bodyLines = rawLines.slice(1);
      }
      const lines: TermLine[] = bodyLines
        .map((line) => {
          const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
          const trimmed = line.trim();
          const bullet = trimmed.startsWith("- ");
          const indent: 0 | 1 = bullet && leadingSpaces >= 2 ? 1 : 0;
          const cleanText = bullet ? trimmed.slice(2) : trimmed;
          return { text: cleanText, bullet, indent };
        })
        .filter((l) => l.text.length > 0);
      return { heading, lines };
    });
}

export type PdfDocData = {
  kind: "Quotation" | "Invoice" | "Receipt";
  number: string;
  /** For receipts: the invoice number this receipt was issued against. */
  invoiceNumber?: string | null;
  title?: string | null;
  poNumber?: string | null;
  status: string;
  issueDate: string;
  secondaryDateLabel: string; // "Valid Until" or "Due Date"
  secondaryDate?: string | null;
  // Which language the standardized Terms/Reminder text (Quotation.language
  // / Invoice.language) is in, and which language this PDF's own static
  // chrome labels (table headers, section headings, signature/authorization
  // text) render in — "EN" | "ZH_HANT" | "ZH_HANS". See DocumentLanguage in
  // src/lib/settings.ts. Receipt has no language of its own and simply
  // inherits its parent invoice's (see buildReceiptPdf in pdf/build.ts).
  language?: string | null;
  customer: {
    name: string;
    contact?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  items: {
    name: string;
    description: string;
    imageData?: string | null;
    unit: string;
    quantity: number;
    multipliers?: { value: number; label: string }[];
    unitPrice: number;
    amount: number;
    duration?: string | null;
    fees?: { label: string; amount: number }[];
  }[];
  subtotal: number;
  // Quotation-only whole-document multiplier for work conducted several
  // times (e.g. a training run 3 times) — when repeatCount > 1, the totals
  // section shows "Subtotal (per session)" = rawSubtotal, "× N sessions",
  // then the already-multiplied Subtotal. Always 1/undefined for Invoice
  // and Receipt, which have no repeat concept.
  repeatCount?: number;
  rawSubtotal?: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentDueDays: number;
  notes?: string | null;
  terms?: string | null;
  reminder?: string | null;
  signatureData?: string | null; // captured e-signature (client on quotations, HR Plus on invoices)
  signatureName?: string | null;
  signedAt?: string | null;
  // True when the quotation was accepted by uploading a scanned/printed
  // document instead of drawing a signature — signatureData is null in
  // that case, but the "Agree & Accepted by" block should still show the
  // client's name and signing date, just without an image.
  signedViaUpload?: boolean;
  relatedLabel?: string; // e.g. "Converted from Quotation QT-2026-0001"
  company: {
    name: string;
    shortName?: string;
    email?: string;
    address?: string;
    website?: string;
    logoData?: string | null;
    chopData?: string | null;
    currency?: string;
    currencyLocale?: string;
    contact?: {
      name?: string;
      title?: string;
      tel?: string;
      email?: string;
    };
    banking?: {
      accountName?: string;
      bank?: string;
      branch?: string;
      accountType?: string;
      bankNumber?: string;
      accountNumber?: string;
      swiftCode?: string;
    };
  };
};

// Fills the totals row's leading gap with the *same five column boxes*
// (no content, borderless except the last) that the item rows use for
// Item/Desc/Pricing/Qty/Duration, instead of a single box sized to their
// combined "73%". Both add up to the same nominal width, but the layout
// engine computes a row of several percentage-width siblings by
// accumulating each one's rounded pixel width in sequence — five small
// roundings down that path don't necessarily land on the exact same
// sub-pixel offset as one big 73% rounding down a completely different
// path, even though the math is identical on paper. Re-walking the
// identical five-box path here guarantees the same accumulated rounding,
// and therefore the same edge, as the item row above.
// The last box (Duration) additionally gets its own borderRightWidth, so
// the Duration/Reference line is drawn the same way here as in the item
// rows: as a right-border on the box to its left, never a left-border on
// the box to its right (that override lives here, not on the shared
// `colDuration` style, because `colDuration` is also reused in the table
// *header*, where its right border must stay white against the navy
// background rather than turn the same dark BORDER color). Keeping every
// vertical line in the table drawn from the same side avoids two
// independently-anti-aliased strokes (one right-border, one left-border)
// landing a sub-pixel apart at the same nominal edge — which is what was
// still causing a 1px-visible gap even after the width math above was
// made to match exactly.
function TotalsSpacer() {
  return (
    <>
      <View style={styles.colItem} />
      <View style={styles.colDesc} />
      <View style={styles.colPricing} />
      <View style={styles.colQty} />
      <View style={[styles.colDuration, styles.totalsSpacerDivider]} />
    </>
  );
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

// -----------------------------------------------------------------------------
// Static PDF chrome labels — table headers, section headings, and
// signature/authorization text that aren't part of the user-editable
// terms/reminder/notes text (which comes pre-translated from
// DEFAULT_TERMS_TEMPLATES/DEFAULT_REMINDER_TEMPLATES in src/lib/settings.ts).
// Same "hand-authored EN/ZH_HANS/ZH_HANT dictionary" pattern as PDF_LABELS in
// RecruitmentAgreementPdf.tsx — split by document kind since Quotation,
// Invoice, and Receipt each have their own distinct chrome. No CJK
// justify-alignment fix is needed here (unlike RecruitmentAgreementPdf.tsx's
// TermsBody) since none of this file's text styles use textAlign: "justify".
// -----------------------------------------------------------------------------
type PdfLanguage = "EN" | "ZH_HANT" | "ZH_HANS";

function resolveLang(language?: string | null): PdfLanguage {
  return language === "ZH_HANS" || language === "ZH_HANT" ? language : "EN";
}

function websiteWord(language?: string | null): string {
  const lang = resolveLang(language);
  if (lang === "ZH_HANS") return "网站";
  if (lang === "ZH_HANT") return "網站";
  return "Website";
}

// The bank name, branch address, and account type read oddly translated
// word-for-word, so Chinese quotations/invoices show HK banking convention
// instead — the account name/number/SWIFT code stay identical across
// languages since those are literal identifiers, not prose. EN keeps
// whatever src/lib/company.ts (or the Settings page override) supplies.
const LOCALIZED_BANKING: Record<PdfLanguage, { bank: string; branch: string; accountType: string } | null> = {
  EN: null,
  ZH_HANS: {
    bank: "汇丰银行 (HSBC)",
    branch: "香港湾仔港湾道30号新鸿基中心汇丰分行",
    accountType: "港币账户",
  },
  ZH_HANT: {
    bank: "匯豐銀行 (HSBC)",
    branch: "香港灣仔港灣道 30 號新鴻基中心匯豐分行",
    accountType: "港幣帳戶",
  },
};

function localizeBanking(
  banking: PdfDocData["company"]["banking"],
  language?: string | null
): PdfDocData["company"]["banking"] {
  if (!banking) return banking;
  const override = LOCALIZED_BANKING[resolveLang(language)];
  return override ? { ...banking, ...override } : banking;
}

const QUOTATION_LABELS: Record<
  PdfLanguage,
  {
    documentKind: string;
    quotationNoLabel: string;
    companyInformation: string;
    companyNameField: string;
    address: string;
    email: string;
    date: string;
    validUntil: string;
    reference: string;
    item: string;
    packageDescription: string;
    pricing: string;
    quantity: string;
    duration: string;
    price: string;
    subtotalPerSession: string;
    sessionsSuffix: (n: number) => string;
    subtotal: string;
    discount: string;
    tax: (rate: number) => string;
    total: string;
    contactInfoHeading: (shortName: string) => string;
    salesName: string;
    contactTitle: string;
    tel: string;
    contactEmail: string;
    bankingInformation: string;
    accountName: string;
    bank: string;
    branch: string;
    accountType: string;
    accountNumber: string;
    swiftCode: string;
    reminderHeading: string;
    remarksHeading: string;
    termsHeading: string;
    forAndOnBehalfOf: string;
    agreeAcceptedBy: string;
    clientName: string;
    signedViaUploadNote: string;
    additionalFee: string;
  }
> = {
  EN: {
    documentKind: "Quotation",
    quotationNoLabel: "Quotation No.",
    companyInformation: "Company Information",
    companyNameField: "Company Name",
    address: "Address",
    email: "Email",
    date: "Date:",
    validUntil: "Valid Until",
    reference: "Reference",
    item: "Item",
    packageDescription: "Package Description",
    pricing: "Pricing",
    quantity: "Quantity",
    duration: "Duration",
    price: "Price",
    subtotalPerSession: "Subtotal (per session)",
    sessionsSuffix: (n) => `× ${n} sessions`,
    subtotal: "Subtotal",
    discount: "Discount",
    tax: (rate) => `Tax (${rate}%)`,
    total: "Total",
    contactInfoHeading: (shortName) => `${shortName} Contact Information`,
    salesName: "Sales Name:",
    contactTitle: "Title:",
    tel: "Tel:",
    contactEmail: "Email:",
    bankingInformation: "Banking Information",
    accountName: "Account Name",
    bank: "Bank",
    branch: "Branch",
    accountType: "Account Type",
    accountNumber: "Account Number",
    swiftCode: "SWIFT CODE",
    reminderHeading: "Reminder",
    remarksHeading: "Remarks",
    termsHeading: "Terms & Conditions",
    forAndOnBehalfOf: "For and on behalf of",
    agreeAcceptedBy: "Agree & Accepted by",
    clientName: "Client Name:",
    signedViaUploadNote: "(Signed via uploaded document — see attached)",
    additionalFee: "Additional fee",
  },
  ZH_HANS: {
    documentKind: "报价单",
    quotationNoLabel: "报价单编号",
    companyInformation: "公司资料",
    companyNameField: "公司名称",
    address: "地址",
    email: "电邮",
    date: "日期：",
    validUntil: "有效期至",
    reference: "参考编号",
    item: "项目",
    packageDescription: "套餐说明",
    pricing: "价格",
    quantity: "数量",
    duration: "时长",
    price: "价格",
    subtotalPerSession: "小计（每场）",
    sessionsSuffix: (n) => `× ${n} 场`,
    subtotal: "小计",
    discount: "折扣",
    tax: (rate) => `税项 (${rate}%)`,
    total: "总额",
    contactInfoHeading: (shortName) => `${shortName} 联络资料`,
    salesName: "销售姓名：",
    contactTitle: "职位：",
    tel: "电话：",
    contactEmail: "电邮：",
    bankingInformation: "银行资料",
    accountName: "账户名称",
    bank: "银行",
    branch: "分行",
    accountType: "账户类型",
    accountNumber: "账户号码",
    swiftCode: "SWIFT代码",
    reminderHeading: "温馨提示",
    remarksHeading: "备注",
    termsHeading: "条款及条件",
    forAndOnBehalfOf: "代表",
    agreeAcceptedBy: "同意及接受方",
    clientName: "客户姓名：",
    signedViaUploadNote: "（透过上传文件签署——请参阅附件）",
    additionalFee: "附加费用",
  },
  ZH_HANT: {
    documentKind: "報價單",
    quotationNoLabel: "報價單編號",
    companyInformation: "公司資料",
    companyNameField: "公司名稱",
    address: "地址",
    email: "電郵",
    date: "日期：",
    validUntil: "有效期至",
    reference: "參考編號",
    item: "項目",
    packageDescription: "套餐說明",
    pricing: "價格",
    quantity: "數量",
    duration: "時長",
    price: "價格",
    subtotalPerSession: "小計（每場）",
    sessionsSuffix: (n) => `× ${n} 場`,
    subtotal: "小計",
    discount: "折扣",
    tax: (rate) => `稅項 (${rate}%)`,
    total: "總額",
    contactInfoHeading: (shortName) => `${shortName} 聯絡資料`,
    salesName: "銷售姓名：",
    contactTitle: "職位：",
    tel: "電話：",
    contactEmail: "電郵：",
    bankingInformation: "銀行資料",
    accountName: "賬戶名稱",
    bank: "銀行",
    branch: "分行",
    accountType: "賬戶類型",
    accountNumber: "賬戶號碼",
    swiftCode: "SWIFT代碼",
    reminderHeading: "溫馨提示",
    remarksHeading: "備註",
    termsHeading: "條款及條件",
    forAndOnBehalfOf: "代表",
    agreeAcceptedBy: "同意及接受方",
    clientName: "客戶姓名：",
    signedViaUploadNote: "（透過上傳文件簽署——請參閱附件）",
    additionalFee: "附加費用",
  },
};

const INVOICE_LABELS: Record<
  PdfLanguage,
  {
    invoiceDate: string;
    invoiceNo: string;
    serviceInvoice: string;
    po: string;
    paymentTerms: string;
    daysSuffix: string;
    invoiceDueDate: string;
    descriptions: string;
    duration: string;
    amount: string;
    subtotal: string;
    discount: string;
    tax: (rate: number) => string;
    totalDue: string;
    remarkText: string;
    bankingInformation: string;
    accountName: string;
    bank: string;
    branch: string;
    accountType: string;
    bankNumber: string;
    accountNumber: string;
    swiftCode: string;
    authorizedBy: (company: string) => string;
    name: string;
    autoNotice: string;
    additionalFee: string;
  }
> = {
  EN: {
    invoiceDate: "Invoice Date:",
    invoiceNo: "Invoice No.:",
    serviceInvoice: "Service Invoice",
    po: "PO:",
    paymentTerms: "Payment Terms:",
    daysSuffix: " days",
    invoiceDueDate: "Invoice Due Date:",
    descriptions: "Descriptions",
    duration: "Duration",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: (rate) => `Tax (${rate}%)`,
    totalDue: "Total Due",
    remarkText:
      "Remark: Please ensure this invoice is settled before the due date in order to activate HR Plus (Talent) guarantee.\nAny associated bank charges will be borne by the client.",
    bankingInformation: "Banking Information",
    accountName: "Account Name",
    bank: "Bank",
    branch: "Branch",
    accountType: "Account Type",
    bankNumber: "Bank Number",
    accountNumber: "Account Number",
    swiftCode: "SWIFT CODE",
    authorizedBy: (company) => `Authorized by ${company}`,
    name: "Name:",
    autoNotice: "This is generated by the system automatically and no signature is required",
    additionalFee: "Additional fee",
  },
  ZH_HANS: {
    invoiceDate: "发票日期：",
    invoiceNo: "发票编号：",
    serviceInvoice: "服务发票",
    po: "采购单编号：",
    paymentTerms: "付款条款：",
    daysSuffix: " 天",
    invoiceDueDate: "发票到期日：",
    descriptions: "项目说明",
    duration: "时长",
    amount: "金额",
    subtotal: "小计",
    discount: "折扣",
    tax: (rate) => `税项 (${rate}%)`,
    totalDue: "应付总额",
    remarkText:
      "备注：请确保于到期日前清付本发票，以启动HR Plus（Talent）的保证服务。\n任何相关银行手续费均由客户承担。",
    bankingInformation: "银行资料",
    accountName: "账户名称",
    bank: "银行",
    branch: "分行",
    accountType: "账户类型",
    bankNumber: "银行编号",
    accountNumber: "账户号码",
    swiftCode: "SWIFT代码",
    authorizedBy: (company) => `获授权代表 ${company}`,
    name: "姓名：",
    autoNotice: "本文件由系统自动生成，不需要签署",
    additionalFee: "附加费用",
  },
  ZH_HANT: {
    invoiceDate: "發票日期：",
    invoiceNo: "發票編號：",
    serviceInvoice: "服務發票",
    po: "採購單編號：",
    paymentTerms: "付款條款：",
    daysSuffix: " 天",
    invoiceDueDate: "發票到期日：",
    descriptions: "項目說明",
    duration: "時長",
    amount: "金額",
    subtotal: "小計",
    discount: "折扣",
    tax: (rate) => `稅項 (${rate}%)`,
    totalDue: "應付總額",
    remarkText:
      "備註：請確保於到期日前清付本發票，以啟動HR Plus（Talent）的保證服務。\n任何相關銀行手續費均由客戶承擔。",
    bankingInformation: "銀行資料",
    accountName: "賬戶名稱",
    bank: "銀行",
    branch: "分行",
    accountType: "賬戶類型",
    bankNumber: "銀行編號",
    accountNumber: "賬戶號碼",
    swiftCode: "SWIFT代碼",
    authorizedBy: (company) => `獲授權代表 ${company}`,
    name: "姓名：",
    autoNotice: "本文件由系統自動生成，不需要簽署",
    additionalFee: "附加費用",
  },
};

const RECEIPT_LABELS: Record<
  PdfLanguage,
  {
    receiptDate: string;
    receiptNo: string;
    receiptHeading: string;
    forInvoiceNo: string;
    descriptions: string;
    duration: string;
    amount: string;
    totalReceived: string;
    thankYou: string;
    additionalFee: string;
  }
> = {
  EN: {
    receiptDate: "Receipt Date:",
    receiptNo: "Receipt No.:",
    receiptHeading: "Receipt",
    forInvoiceNo: "For Invoice No.:",
    descriptions: "Descriptions",
    duration: "Duration",
    amount: "Amount",
    totalReceived: "Total Received",
    thankYou: "Thank you for using our service!",
    additionalFee: "Additional fee",
  },
  ZH_HANS: {
    receiptDate: "收据日期：",
    receiptNo: "收据编号：",
    receiptHeading: "收据",
    forInvoiceNo: "对应发票编号：",
    descriptions: "项目说明",
    duration: "时长",
    amount: "金额",
    totalReceived: "已收总额",
    thankYou: "感谢您使用我们的服务！",
    additionalFee: "附加费用",
  },
  ZH_HANT: {
    receiptDate: "收據日期：",
    receiptNo: "收據編號：",
    receiptHeading: "收據",
    forInvoiceNo: "對應發票編號：",
    descriptions: "項目說明",
    duration: "時長",
    amount: "金額",
    totalReceived: "已收總額",
    thankYou: "感謝您使用我們的服務！",
    additionalFee: "附加費用",
  },
};

function QuotationDocument({ data }: { data: PdfDocData }) {
  const t = QUOTATION_LABELS[resolveLang(data.language)];
  const banking = localizeBanking(data.company.banking, data.language);
  const currency = (n: number) =>
    new Intl.NumberFormat(data.company.currencyLocale || "en-HK", {
      style: "currency",
      currency: data.company.currency || "HKD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n || 0);
  const currencyCode = data.company.currency || "HKD";

  const customerAddress = data.customer.address || "";

  const shortName = data.company.shortName || data.company.name;
  // Quotation-only: work conducted several times (e.g. a training run 3
  // times) shows a "Subtotal (per session) × N sessions" breakdown above
  // the (already-multiplied) Subtotal row — see repeatCount/rawSubtotal on
  // PdfDocData. Always false for Invoice/Receipt, which never set these.
  const showRepeatBreakdown = Boolean((data.repeatCount || 1) > 1 && data.rawSubtotal !== undefined);
  const hasTotalsExtras = data.discount > 0 || data.taxRate > 0 || showRepeatBreakdown;

  return (
    <Document title={`${t.documentKind} ${data.number}`} author={data.company.name}>
      <Page size="A4" style={styles.page}>
        {/* Logo (or company name fallback) top right */}
        <View style={styles.logoRow}>
          {data.company.logoData ? (
            <Image style={styles.logo} src={data.company.logoData} />
          ) : (
            <Text style={styles.brandNameFallback}>{data.company.name}</Text>
          )}
        </View>

        {/* Title bar */}
        <View style={styles.titleBar}>
          <Text style={styles.titleKind}>{t.documentKind}</Text>
          <Text style={styles.titleText}>{data.title || ""}</Text>
        </View>

        {/* Company information */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.companyInformation}</Text>
          <KvRow label={t.companyNameField} value={data.customer.name} />
          <KvRow label={t.address} value={customerAddress || null} />
          <KvRow label={t.email} value={data.customer.email} />
          <KvRow label={t.date} value={formatDateShort(data.issueDate)} />
          <KvRow
            label={`${t.validUntil}:`}
            value={data.secondaryDate ? formatDateShort(data.secondaryDate) : null}
          />
          <KvRow label={t.quotationNoLabel} value={data.number} />
          <KvRow label={t.reference} value={data.relatedLabel || null} />
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colItem]}>{t.item}</Text>
            <Text style={[styles.th, styles.colDesc]}>{t.packageDescription}</Text>
            <Text style={[styles.th, styles.colPricing]}>{`${t.pricing}\n(${currencyCode})`}</Text>
            <Text style={[styles.th, styles.colQty]}>{t.quantity}</Text>
            <Text style={[styles.th, styles.colDuration]}>{t.duration}</Text>
            <Text style={[styles.th, styles.colRef]}>{t.reference}</Text>
            <Text style={[styles.th, styles.colPrice, { borderRightWidth: 0 }]}>
              {`${t.price}\n(${currencyCode})`}
            </Text>
          </View>

          {data.items.map((item, i) => (
            <View style={styles.tableRow} key={i} wrap={!rowFitsOnOnePage(item)}>
              <View style={[styles.cell, styles.colItem]}>
                <Text style={styles.itemName}>{item.name}</Text>
              </View>
              <View style={[styles.cell, styles.colDesc]}>
                {item.description ? <Text style={styles.descText}>{item.description}</Text> : null}
                {(item.fees || []).map((fee, fi) => (
                  <Text key={fi} style={styles.feeText}>
                    {fee.label || t.additionalFee}: {currency(fee.amount)}
                  </Text>
                ))}
              </View>
              <View style={[styles.cell, styles.colPricing]}>
                <Text style={styles.centerText}>
                  {currency(item.unitPrice)}
                  {item.unit ? `\n/ ${item.unit}` : ""}
                </Text>
              </View>
              <View style={[styles.cell, styles.colQty]}>
                <Text style={styles.centerText}>
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                  {(item.multipliers || [])
                    .map((m) => `\n× ${m.value}${m.label ? ` ${m.label}` : ""}`)
                    .join("")}
                </Text>
              </View>
              <View style={[styles.cell, styles.colDuration]}>
                <Text style={styles.centerText}>{item.duration || "—"}</Text>
              </View>
              <View style={[styles.cell, styles.colRef]}>
                {item.imageData ? <Image style={styles.refImage} src={item.imageData} /> : null}
              </View>
              <View style={[styles.cell, styles.colPrice]}>
                <Text style={[styles.centerText, { textAlign: "right" }]}>
                  {currency(lineTotalWithFee(item))}
                </Text>
              </View>
            </View>
          ))}

          {showRepeatBreakdown && (
            <>
              <View style={styles.totalsRow} wrap={false}>
                <TotalsSpacer />
                <View style={styles.totalsLabelCell}>
                  <Text style={styles.totalsLabel}>{t.subtotalPerSession}</Text>
                </View>
                <View style={styles.totalsValueCell}>
                  <Text style={styles.totalsValue}>{currency(data.rawSubtotal as number)}</Text>
                </View>
              </View>
              <View style={styles.totalsRow} wrap={false}>
                <TotalsSpacer />
                <View style={styles.totalsLabelCell}>
                  <Text style={styles.totalsLabel}>{t.sessionsSuffix(data.repeatCount || 1)}</Text>
                </View>
                <View style={styles.totalsValueCell} />
              </View>
            </>
          )}
          {hasTotalsExtras && (
            <View style={styles.totalsRow} wrap={false}>
              <TotalsSpacer />
              <View style={styles.totalsLabelCell}>
                <Text style={styles.totalsLabel}>{t.subtotal}</Text>
              </View>
              <View style={styles.totalsValueCell}>
                <Text style={styles.totalsValue}>{currency(data.subtotal)}</Text>
              </View>
            </View>
          )}
          {data.discount > 0 && (
            <View style={styles.totalsRow} wrap={false}>
              <TotalsSpacer />
              <View style={styles.totalsLabelCell}>
                <Text style={styles.totalsLabel}>{t.discount}</Text>
              </View>
              <View style={styles.totalsValueCell}>
                <Text style={styles.totalsValue}>-{currency(data.discount)}</Text>
              </View>
            </View>
          )}
          {data.taxRate > 0 && (
            <View style={styles.totalsRow} wrap={false}>
              <TotalsSpacer />
              <View style={styles.totalsLabelCell}>
                <Text style={styles.totalsLabel}>{t.tax(data.taxRate)}</Text>
              </View>
              <View style={styles.totalsValueCell}>
                <Text style={styles.totalsValue}>{currency(data.taxAmount)}</Text>
              </View>
            </View>
          )}
          <View style={styles.totalsRow} wrap={false}>
            <TotalsSpacer />
            <View style={styles.totalsLabelCell}>
              <Text style={styles.grandLabel}>{t.total}</Text>
            </View>
            <View style={styles.totalsValueCell}>
              <Text style={styles.grandValue}>{currency(data.total)}</Text>
            </View>
          </View>
        </View>

        {/* Contact information */}
        {data.company.contact && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>{t.contactInfoHeading(shortName)}</Text>
            <KvRow label={t.salesName} value={data.company.contact.name} />
            <KvRow label={t.contactTitle} value={data.company.contact.title} />
            <KvRow label={t.tel} value={data.company.contact.tel} />
            <KvRow label={t.contactEmail} value={data.company.contact.email} />
          </View>
        )}

        {/* Banking information */}
        {banking && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>{t.bankingInformation}</Text>
            <KvRow label={t.accountName} value={banking.accountName} />
            <KvRow label={t.bank} value={banking.bank} />
            <KvRow label={t.branch} value={banking.branch} />
            <KvRow label={t.accountType} value={banking.accountType} />
            <KvRow label={t.accountNumber} value={banking.accountNumber} />
            <KvRow label={t.swiftCode} value={banking.swiftCode} />
          </View>
        )}

        {/* Reminder — sits between Banking Information and Terms & Conditions */}
        {data.reminder ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>{t.reminderHeading}</Text>
            <View style={styles.sectionBody}>
              <Text style={styles.sectionText}>{data.reminder}</Text>
            </View>
          </View>
        ) : null}

        {/* Notes / remarks */}
        {data.notes ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>{t.remarksHeading}</Text>
            <View style={styles.sectionBody}>
              <Text style={styles.sectionText}>{data.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Terms & conditions */}
        {data.terms ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>{t.termsHeading}</Text>
            <View style={styles.sectionBody}>
              {parseTermsClauses(data.terms).map((clause, ci) => (
                <View key={ci} style={styles.termClause} wrap={false}>
                  {clause.heading ? (
                    <Text style={styles.termHeading}>{clause.heading}</Text>
                  ) : null}
                  {clause.lines.map((line, li) => (
                    <Text
                      key={li}
                      style={
                        line.bullet
                          ? line.indent
                            ? styles.termSubBullet
                            : styles.termBullet
                          : styles.termParagraph
                      }
                    >
                      {line.bullet ? "•  " : ""}
                      {line.text}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Client acceptance (quotations only), with the HR Plus chop stamp
            shown alongside it as HR Plus's counter-authorization */}
        {data.kind === "Quotation" && (
          <View style={styles.signRow} wrap={false}>
            {data.company.chopData && (
              <View style={styles.chopBlock}>
                <Text style={[styles.signText, { fontFamily: PDF_FONT_BOLD, fontWeight: "bold" }]}>
                  {t.forAndOnBehalfOf}
                </Text>
                <Text style={[styles.signText, { fontFamily: PDF_FONT_BOLD, fontWeight: "bold" }]}>
                  {data.company.name}
                </Text>
                <Image style={styles.chopImage} src={data.company.chopData} />
              </View>
            )}
            <View style={styles.signBlock}>
              <Text style={[styles.signText, { fontFamily: PDF_FONT_BOLD, fontWeight: "bold" }]}>
                {t.agreeAcceptedBy}
              </Text>
              <Text style={styles.signText}>
                {t.clientName}{" "}
                {data.signatureData || data.signedViaUpload
                  ? data.signatureName || data.customer.name
                  : ""}
              </Text>
              {data.signatureData ? (
                <View style={styles.signImageBox}>
                  <Image style={styles.signImage} src={data.signatureData} />
                </View>
              ) : data.signedViaUpload ? (
                // No italic override here — see the comment on `feeText`
                // above; NotoSansSC has no registered italic face, so this
                // crashed the render for any quotation accepted via an
                // uploaded document. The muted color already sets this
                // note apart from the line above it.
                <Text style={[styles.signText, { color: "#555555" }]}>
                  {t.signedViaUploadNote}
                </Text>
              ) : (
                <View style={styles.signLine} />
              )}
              <Text style={styles.signText}>
                {t.date}{" "}
                {(data.signatureData || data.signedViaUpload) && data.signedAt
                  ? formatDateShort(data.signedAt)
                  : ""}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {data.company.name} · {t.documentKind} {data.number}
        </Text>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Invoice — dedicated "Service Invoice" letterhead layout matching the HR
// Plus PDF format (plain letterhead, Descriptions/Amount table, bordered
// Banking Information grid, auto-generated notice in place of a signature).
// ---------------------------------------------------------------------------

const invoiceStyles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 9.5,
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  logo: {
    width: 110,
    objectFit: "contain",
  },
  brandNameFallback: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 16,
    color: NAVY,
  },
  headerMeta: {
    alignItems: "flex-end",
  },
  headerMetaText: {
    fontSize: 9.5,
    marginBottom: 2,
  },
  clientBlock: {
    marginBottom: 14,
  },
  clientLine: {
    fontSize: 9.5,
    lineHeight: 1.4,
  },
  clientName: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 9.5,
    lineHeight: 1.4,
  },
  heading: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 14,
  },
  metaLine: {
    fontSize: 9.5,
    marginBottom: 3,
  },
  table: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
  },
  th: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 9.5,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thDesc: { flex: 1, borderRightWidth: 1, borderRightColor: BORDER },
  thAmount: { width: "28%", textAlign: "right" },
  // borderTop-only (no bottom border) — this is the ONLY separator line
  // between rows, including between the header and the first item row.
  // Giving the header its own bottom border too would stack right against
  // this row's top border and render as one much thicker/bolder line right
  // under the header than the 0.8pt lines between every other row.
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 0.8,
    borderTopColor: BORDER,
  },
  cellDesc: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  // flex-start, not center — see the matching comment on `cell` in the
  // quotation table styles above. A long item description can push this
  // row past a page break; centering the amount against the row's full
  // (un-split) height risks it landing on a different page fragment than
  // where the row and its description actually start.
  cellAmount: {
    width: "28%",
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "flex-start",
  },
  itemNameText: {
    fontSize: 9.5,
  },
  itemDescText: {
    fontSize: 8,
    color: "#333333",
    marginTop: 1,
  },
  // See the matching comment on `feeText` above — no italic, same reason.
  itemFeeText: {
    fontSize: 7.5,
    color: "#555555",
    marginTop: 1,
  },
  // A fee's own row (see the `data.items.map` below) — indented under its
  // parent item and slightly smaller/muted than `itemNameText` so it still
  // reads as an addition to the item above rather than a peer item, even
  // though it's now a full row with its own amount in the price column.
  cellDescFeeRow: {
    paddingLeft: 20,
  },
  itemFeeRowNameText: {
    fontSize: 8.5,
    color: "#333333",
  },
  amountText: {
    fontSize: 9.5,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  totalLabelText: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 9.5,
    textAlign: "right",
  },
  totalAmountText: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 9.5,
    textAlign: "right",
    textDecoration: "underline",
  },
  remark: {
    fontSize: 8,
    lineHeight: 1.4,
    marginBottom: 14,
  },
  bankingHeading: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 10.5,
    marginBottom: 6,
  },
  bankingTable: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  bankingRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  bankingRowFirst: {
    flexDirection: "row",
  },
  bankingLabel: {
    width: "28%",
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  bankingValue: {
    flex: 1,
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  autoNotice: {
    fontFamily: PDF_FONT_BOLD, fontWeight: "bold",
    fontSize: 9.5,
    textAlign: "center",
    marginTop: 10,
  },
  signBlock: {
    marginTop: 14,
    width: 250,
  },
  signText: {
    fontSize: 8.5,
    marginBottom: 2,
  },
  signImage: {
    maxHeight: 44,
    maxWidth: 200,
    objectFit: "contain",
    marginBottom: 2,
  },
  // Company chop, stamped bottom-right of the invoice/receipt — sits in
  // normal document flow (not absolutely positioned) so it naturally lands
  // after whatever content precedes it (the authorization block) rather
  // than risking an overlap on a page that runs long.
  chopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  chopImage: {
    width: 90,
    height: 89,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 50,
    right: 50,
    textAlign: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#33415a",
  },
  footerBar: {
    marginTop: 8,
    height: 4,
    backgroundColor: NAVY,
  },
});

function BankingRow({
  label,
  value,
  first,
}: {
  label: string;
  value?: string | null;
  first?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={first ? invoiceStyles.bankingRowFirst : invoiceStyles.bankingRow}>
      <Text style={invoiceStyles.bankingLabel}>{label}</Text>
      <Text style={invoiceStyles.bankingValue}>{value}</Text>
    </View>
  );
}

function InvoiceDocument({ data }: { data: PdfDocData }) {
  const t = INVOICE_LABELS[resolveLang(data.language)];
  const banking = localizeBanking(data.company.banking, data.language);
  const currency = (n: number) =>
    new Intl.NumberFormat(data.company.currencyLocale || "en-HK", {
      style: "currency",
      currency: data.company.currency || "HKD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n || 0);

  const hasTotalsExtras = data.discount > 0 || data.taxRate > 0;

  const clientLines = [data.customer.contact, ...(data.customer.address || "").split("\n")].filter(
    Boolean
  ) as string[];

  return (
    <Document title={`Invoice ${data.number}`} author={data.company.name}>
      <Page size="A4" style={invoiceStyles.page}>
        {/* Logo top-left, invoice date/number top-right */}
        <View style={invoiceStyles.headerRow}>
          {data.company.logoData ? (
            <Image style={invoiceStyles.logo} src={data.company.logoData} />
          ) : (
            <Text style={invoiceStyles.brandNameFallback}>{data.company.name}</Text>
          )}
          <View style={invoiceStyles.headerMeta}>
            <Text style={invoiceStyles.headerMetaText}>
              {t.invoiceDate} {formatDateShort(data.issueDate)}
            </Text>
            <Text style={invoiceStyles.headerMetaText}>{t.invoiceNo} {data.number}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={invoiceStyles.clientBlock}>
          {data.customer.contact && (
            <Text style={invoiceStyles.clientLine}>{data.customer.contact}</Text>
          )}
          <Text style={invoiceStyles.clientName}>{data.customer.name}</Text>
          {(data.customer.address || "")
            .split("\n")
            .filter(Boolean)
            .map((line, i) => (
              <Text key={i} style={invoiceStyles.clientLine}>
                {line}
              </Text>
            ))}
          {data.customer.phone && (
            <Text style={invoiceStyles.clientLine}>{data.customer.phone}</Text>
          )}
        </View>

        <Text style={invoiceStyles.heading}>{t.serviceInvoice}</Text>

        {/* PO / payment terms / due date */}
        {data.poNumber ? (
          <Text style={invoiceStyles.metaLine}>{t.po} {data.poNumber}</Text>
        ) : null}
        <Text style={invoiceStyles.metaLine}>
          {t.paymentTerms} {data.paymentDueDays}{t.daysSuffix}
        </Text>
        <Text style={invoiceStyles.metaLine}>
          {t.invoiceDueDate} {data.secondaryDate ? formatDateShort(data.secondaryDate) : "—"}
        </Text>

        {/* Descriptions / Amount table */}
        <View style={invoiceStyles.table}>
          <View style={invoiceStyles.tableHeaderRow}>
            <Text style={[invoiceStyles.th, invoiceStyles.thDesc]}>{t.descriptions}</Text>
            <Text style={[invoiceStyles.th, invoiceStyles.thAmount]}>
              {`${t.amount}\n(${data.company.currency || "HKD"})`}
            </Text>
          </View>

          {data.items.map((item, i) => (
            <React.Fragment key={i}>
              <View style={invoiceStyles.tableRow} wrap={!rowFitsOnOnePage(item)}>
                <View style={invoiceStyles.cellDesc}>
                  <Text style={invoiceStyles.itemNameText}>{item.name}</Text>
                  {item.description ? (
                    <Text style={invoiceStyles.itemDescText}>{item.description}</Text>
                  ) : null}
                  {item.duration ? (
                    <Text style={invoiceStyles.itemDescText}>{t.duration}: {item.duration}</Text>
                  ) : null}
                </View>
                <View style={invoiceStyles.cellAmount}>
                  <Text style={invoiceStyles.amountText}>{currency(item.amount)}</Text>
                </View>
              </View>
              {/* Each additional fee gets its own row — like a small extra
                  item under the one it belongs to — with its own amount in
                  the price column, rather than being folded silently into
                  the parent item's total or shown as plain descriptive text. */}
              {(item.fees || []).map((fee, fi) => (
                <View style={invoiceStyles.tableRow} key={`fee-${fi}`} wrap={false}>
                  <View style={[invoiceStyles.cellDesc, invoiceStyles.cellDescFeeRow]}>
                    <Text style={invoiceStyles.itemFeeRowNameText}>{fee.label || t.additionalFee}</Text>
                  </View>
                  <View style={invoiceStyles.cellAmount}>
                    <Text style={invoiceStyles.amountText}>{currency(fee.amount)}</Text>
                  </View>
                </View>
              ))}
            </React.Fragment>
          ))}

          {hasTotalsExtras && (
            <View style={invoiceStyles.totalRow} wrap={false}>
              <View style={invoiceStyles.cellDesc}>
                <Text style={invoiceStyles.totalLabelText}>{t.subtotal}</Text>
              </View>
              <View style={invoiceStyles.cellAmount}>
                <Text style={invoiceStyles.amountText}>{currency(data.subtotal)}</Text>
              </View>
            </View>
          )}
          {data.discount > 0 && (
            <View style={invoiceStyles.totalRow} wrap={false}>
              <View style={invoiceStyles.cellDesc}>
                <Text style={invoiceStyles.totalLabelText}>{t.discount}</Text>
              </View>
              <View style={invoiceStyles.cellAmount}>
                <Text style={invoiceStyles.amountText}>-{currency(data.discount)}</Text>
              </View>
            </View>
          )}
          {data.taxRate > 0 && (
            <View style={invoiceStyles.totalRow} wrap={false}>
              <View style={invoiceStyles.cellDesc}>
                <Text style={invoiceStyles.totalLabelText}>{t.tax(data.taxRate)}</Text>
              </View>
              <View style={invoiceStyles.cellAmount}>
                <Text style={invoiceStyles.amountText}>{currency(data.taxAmount)}</Text>
              </View>
            </View>
          )}
          <View style={invoiceStyles.totalRow} wrap={false}>
            <View style={invoiceStyles.cellDesc}>
              <Text style={invoiceStyles.totalLabelText}>{t.totalDue}</Text>
            </View>
            <View style={invoiceStyles.cellAmount}>
              <Text style={invoiceStyles.totalAmountText}>{currency(data.total)}</Text>
            </View>
          </View>
        </View>

        {/* Remark — fixed standard wording for every invoice */}
        <Text style={invoiceStyles.remark}>{t.remarkText}</Text>

        {/* Banking information */}
        {banking && (
          <View wrap={false}>
            <Text style={invoiceStyles.bankingHeading}>{t.bankingInformation}</Text>
            <View style={invoiceStyles.bankingTable}>
              <BankingRow label={t.accountName} value={banking.accountName} first />
              <BankingRow label={t.bank} value={banking.bank} />
              <BankingRow label={t.branch} value={banking.branch} />
              <BankingRow label={t.accountType} value={banking.accountType} />
              <BankingRow label={t.bankNumber} value={banking.bankNumber} />
              <BankingRow label={t.accountNumber} value={banking.accountNumber} />
              <BankingRow label={t.swiftCode} value={banking.swiftCode} />
            </View>
          </View>
        )}

        {/* Authorization: a captured signature if present. */}
        {data.signatureData && (
          <View style={invoiceStyles.signBlock} wrap={false}>
            <Text style={[invoiceStyles.signText, { fontFamily: PDF_FONT_BOLD, fontWeight: "bold" }]}>
              {t.authorizedBy(data.company.shortName || data.company.name)}
            </Text>
            <Image style={invoiceStyles.signImage} src={data.signatureData} />
            {data.signatureName ? (
              <Text style={[invoiceStyles.signText, { marginTop: 2 }]}>
                {t.name} {data.signatureName}
              </Text>
            ) : null}
          </View>
        )}

        {data.company.chopData && (
          <View style={invoiceStyles.chopRow} wrap={false}>
            <Image style={invoiceStyles.chopImage} src={data.company.chopData} />
          </View>
        )}

        {/* Standard "no signature required" notice — shown under the chop
            whenever there's no captured signature, rather than in place of
            it, so the chop stamp itself is never displaced. */}
        {!data.signatureData && <Text style={invoiceStyles.autoNotice}>{t.autoNotice}</Text>}

        <View style={invoiceStyles.footer} fixed>
          {data.company.address ? (
            <Text style={invoiceStyles.footerText}>{data.company.address}</Text>
          ) : null}
          {data.company.website ? (
            <Text style={invoiceStyles.footerText}>{websiteWord(data.language)}: {data.company.website}</Text>
          ) : null}
          <View style={invoiceStyles.footerBar} />
        </View>
      </Page>
    </Document>
  );
}

function ReceiptDocument({ data }: { data: PdfDocData }) {
  const t = RECEIPT_LABELS[resolveLang(data.language)];
  const currency = (n: number) =>
    new Intl.NumberFormat(data.company.currencyLocale || "en-HK", {
      style: "currency",
      currency: data.company.currency || "HKD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n || 0);

  return (
    <Document title={`Receipt ${data.number}`} author={data.company.name}>
      <Page size="A4" style={invoiceStyles.page}>
        {/* Logo top-left, receipt date/number top-right */}
        <View style={invoiceStyles.headerRow}>
          {data.company.logoData ? (
            <Image style={invoiceStyles.logo} src={data.company.logoData} />
          ) : (
            <Text style={invoiceStyles.brandNameFallback}>{data.company.name}</Text>
          )}
          <View style={invoiceStyles.headerMeta}>
            <Text style={invoiceStyles.headerMetaText}>
              {t.receiptDate} {formatDateShort(data.issueDate)}
            </Text>
            <Text style={invoiceStyles.headerMetaText}>{t.receiptNo} {data.number}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={invoiceStyles.clientBlock}>
          {data.customer.contact && (
            <Text style={invoiceStyles.clientLine}>{data.customer.contact}</Text>
          )}
          <Text style={invoiceStyles.clientName}>{data.customer.name}</Text>
          {(data.customer.address || "")
            .split("\n")
            .filter(Boolean)
            .map((line, i) => (
              <Text key={i} style={invoiceStyles.clientLine}>
                {line}
              </Text>
            ))}
        </View>

        <Text style={invoiceStyles.heading}>{t.receiptHeading}</Text>

        {data.invoiceNumber ? (
          <Text style={invoiceStyles.metaLine}>{t.forInvoiceNo} {data.invoiceNumber}</Text>
        ) : null}

        {/* Descriptions / Amount table */}
        <View style={invoiceStyles.table}>
          <View style={invoiceStyles.tableHeaderRow}>
            <Text style={[invoiceStyles.th, invoiceStyles.thDesc]}>{t.descriptions}</Text>
            <Text style={[invoiceStyles.th, invoiceStyles.thAmount]}>
              {`${t.amount}\n(${data.company.currency || "HKD"})`}
            </Text>
          </View>

          {data.items.map((item, i) => (
            <View style={invoiceStyles.tableRow} key={i} wrap={!rowFitsOnOnePage(item)}>
              <View style={invoiceStyles.cellDesc}>
                <Text style={invoiceStyles.itemNameText}>{item.name}</Text>
                {item.description ? (
                  <Text style={invoiceStyles.itemDescText}>{item.description}</Text>
                ) : null}
                {item.duration ? (
                  <Text style={invoiceStyles.itemDescText}>{t.duration}: {item.duration}</Text>
                ) : null}
                {(item.fees || []).map((fee, fi) => (
                  <Text key={fi} style={invoiceStyles.itemFeeText}>
                    {fee.label || t.additionalFee}: {currency(fee.amount)}
                  </Text>
                ))}
              </View>
              <View style={invoiceStyles.cellAmount}>
                <Text style={invoiceStyles.amountText}>{currency(lineTotalWithFee(item))}</Text>
              </View>
            </View>
          ))}

          <View style={invoiceStyles.totalRow} wrap={false}>
            <View style={invoiceStyles.cellDesc}>
              <Text style={invoiceStyles.totalLabelText}>{t.totalReceived}</Text>
            </View>
            <View style={invoiceStyles.cellAmount}>
              <Text style={invoiceStyles.totalAmountText}>{currency(data.total)}</Text>
            </View>
          </View>
        </View>

        <Text style={[invoiceStyles.autoNotice, { marginTop: 24 }]}>
          {t.thankYou}
        </Text>

        {data.company.chopData && (
          <View style={invoiceStyles.chopRow} wrap={false}>
            <Image style={invoiceStyles.chopImage} src={data.company.chopData} />
          </View>
        )}

        <View style={invoiceStyles.footer} fixed>
          {data.company.address ? (
            <Text style={invoiceStyles.footerText}>{data.company.address}</Text>
          ) : null}
          {data.company.website ? (
            <Text style={invoiceStyles.footerText}>{websiteWord(data.language)}: {data.company.website}</Text>
          ) : null}
          <View style={invoiceStyles.footerBar} />
        </View>
      </Page>
    </Document>
  );
}

export function DocumentPdf({ data }: { data: PdfDocData }) {
  if (data.kind === "Invoice") {
    return <InvoiceDocument data={data} />;
  }
  if (data.kind === "Receipt") {
    return <ReceiptDocument data={data} />;
  }
  return <QuotationDocument data={data} />;
}
