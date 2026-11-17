import { Converter } from "opencc-js";
import type { AppLanguage } from "@/lib/i18n/language";

// -----------------------------------------------------------------------------
// Document defaults — the single source of truth for standardized wording that
// is auto-populated onto new quotations and invoices.
//
// This module is intentionally the ONLY place these templates live. A future
// admin Settings page can persist overrides (e.g. in a `Setting` table) and
// have `getDocumentDefaults()` merge them on top of these constants — the rest
// of the app already reads everything through the helpers below, so no other
// file needs to change when that happens.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Document language (Quotation.language / Invoice.language) — which language
// the standardized Terms & Reminder template text is generated in, and which
// static PDF chrome labels (table headers, section headings, signature block
// text — see the PDF_LABELS dictionaries in src/lib/pdf/DocumentPdf.tsx) get
// used. Same three-language pattern as RecruitmentLanguage in
// src/lib/recruitmentTerms.ts, kept as an independent type here since
// quotations/invoices/receipts are a different document family with their own
// templates — company data, item names/descriptions, and any custom Notes
// text stay exactly as entered regardless of this setting.
// -----------------------------------------------------------------------------
export type DocumentLanguage = "EN" | "ZH_HANT" | "ZH_HANS";
export const VALID_DOCUMENT_LANGUAGES: DocumentLanguage[] = ["EN", "ZH_HANT", "ZH_HANS"];
export const DOCUMENT_LANGUAGE_LABELS: Record<DocumentLanguage, string> = {
  EN: "English",
  ZH_HANT: "繁體中文 (Traditional Chinese)",
  ZH_HANS: "简体中文 (Simplified Chinese)",
};

export const DEFAULT_PAYMENT_DUE_DAYS = 30;

/**
 * Standardized Terms & Conditions template — the exact wording HR Plus uses
 * on quotations (see term.docx). Each clause is "N. Heading" on its own line
 * followed by a blank line then the clause body; the PDF renderer bolds the
 * "N. Heading" line and turns "- " / "  - " lines into bulleted sub-points.
 * Clauses are separated by a blank line.
 */
export const DEFAULT_TERMS_TEMPLATE = `1. Currency
All prices quoted in this Quotation are in Hong Kong Dollars (HKD) and are exclusive of any applicable taxes, unless otherwise stated.

2. Bank Charges
Any bank charges, wire transfer fees, or other financial costs incurred in connection with payments under this Quotation shall be borne solely by the Client.

3. Lead Time
The Client must sign and return the Quotation at least two (2) weeks prior to the date of the first Event. HR Plus reserves the right to adjust scheduling or decline the booking if this requirement is not met.

4. Payment Terms
Payment shall be made in full within {{paymentDueDays}} days from the date of the signed Quotation (NET {{paymentDueDays}} days), unless otherwise agreed in writing. Invoices will be issued upon confirmation. Late payments may attract interest at the rate of 2% per month (or part thereof) on the overdue amount.

5. Delivery (Incoterms)
All deliveries shall be on a DDP (Delivered Duty Paid) Hong Kong basis to the Client's designated office in Hong Kong. HR Plus shall be responsible for all transportation, customs (if applicable), delivery, and related costs to the Event site.

6. Cancellation and Rescheduling
Written notice (via email or formal letter) is required for any cancellation or rescheduling. "Working days" exclude Saturdays, Sundays, and public holidays in Hong Kong.
- With at least five (5) working days' notice:
  - Rescheduling: Free of charge, subject to availability.
  - Full cancellation: A cancellation fee of 20% of the total service fee shall be payable to cover administrative and preparatory costs.
  - HR Plus reserves the right to charge the additional fee if significant preparation or third-party commitments have already been made.
- With less than five (5) working days' notice or no notice:
  - Rescheduling with less than five (5) working days' notice: Subject to an additional handling fee of HK$1,000.
  - Full Cancellation: 50% of the total Event fee shall be payable by the Client.
  - HR Plus reserves the right to charge the full fee if significant preparation or third-party commitments have already been made.

7. Inclement Weather / Force Majeure
The Event may be cancelled or rescheduled at no additional cost to the Client if a Typhoon Signal No. 8 or above, Black Rainstorm Warning, or "Extreme Conditions" warning issued by the Hong Kong Observatory or the HKSAR Government is:
- In force within four (4) hours before the scheduled commencement of the Event, or
- Cancelled after 12:00 noon on the day of the Event.

8. Liability
HR Plus shall not be liable for any loss, damage, claims, or liabilities arising from the Event, including but not limited to injury to persons, damage to property, or any indirect/consequential losses.

9. Acceptance
By signing this Quotation, the Client confirms acceptance of these Terms and Conditions in their entirety and agrees to be bound by them.

10. Marketing Authorisation
By signing this Quotation, the Client grants HR Plus a non-exclusive, royalty-free licence to use the Client's name, event photo and logo in HR Plus's marketing materials, website, and case studies. This authorisation may be revoked at any time by the Client upon written notice.

11. Amendments
No amendment or variation to these Terms and Conditions or the Quotation shall be effective unless made in writing and signed by both parties.

12. Governing Law and Jurisdiction
This Quotation and these Terms and Conditions shall be governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region. Any dispute arising out of or in connection with this Quotation shall be subject to the non-exclusive jurisdiction of the Hong Kong courts.

13. Third-Party Rights
A person who is not a party to this Quotation has no right under the Contracts (Rights of Third Parties) Ordinance (Cap. 623) to enforce any term of this Quotation.`;

/**
 * Standardized Reminder template. Shown between Banking Information and
 * Terms & Conditions on both quotations and invoices.
 */
export const DEFAULT_REMINDER_TEMPLATE = `• Please complete payment before the due date.
• Kindly include the invoice number or quotation number as the payment reference.
• Please contact us if you have any questions regarding this document.`;

// -----------------------------------------------------------------------------
// Simplified Chinese translations of the same Terms & Reminder templates
// above — same 13-clause structure/numbering and "- " / "  - " bullet syntax
// (so DocumentPdf.tsx's parseTermsClauses still bolds/bullets them
// correctly) and the same {{paymentDueDays}} placeholder, just translated.
// This is the single authored Chinese source for both templates —
// ZH_HANT below is derived from THIS text via OpenCC script conversion
// rather than hand-duplicated, mirroring RECRUITMENT_TERMS_TEMPLATE_ZH_HANT
// in src/lib/recruitmentTerms.ts so the two Chinese versions can never
// drift apart.
// -----------------------------------------------------------------------------
export const DEFAULT_TERMS_TEMPLATE_ZH_HANS = `1. 货币
本报价单所报之所有价格均以港币（HKD）计算，除另有说明外，不包括任何适用税项。

2. 银行手续费
因本报价单项下付款而产生的任何银行手续费、电汇费用或其他财务费用，均由客户自行承担。

3. 提前期
客户必须在首次活动日期至少两（2）周前签署并交回报价单。如未能符合此要求，HR Plus保留调整日程安排或拒绝接受预订的权利。

4. 付款条款
除另有书面协议外，付款须于已签署报价单的日期起{{paymentDueDays}}天内全数支付（净{{paymentDueDays}}天）。发票将于确认后开立。逾期付款可能须按逾期款额每月（或不足一月）2%的利率计息。

5. 交付（贸易术语）
所有交付均按DDP（完税后交货）香港条款，送达客户在香港指定的办公地点。HR Plus将负责运送至活动场地所涉及的一切运输、海关（如适用）、送货及相关费用。

6. 取消及重新安排
任何取消或重新安排均须以书面通知（电邮或正式信函）方式提出。"工作日"不包括星期六、星期日及香港公众假期。
- 如提前至少五（5）个工作日通知：
  - 重新安排：免费，视供应情况而定。
  - 全额取消：须支付相当于服务总费用20%的取消费，以支付行政及筹备成本。
  - 如已作出重大筹备或与第三方作出承诺，HR Plus保留收取额外费用的权利。
- 如通知不足五（5）个工作日或未作通知：
  - 不足五（5）个工作日通知的重新安排：须缴付额外港币1,000元的手续费。
  - 全额取消：客户须支付活动总费用的50%。
  - 如已作出重大筹备或与第三方作出承诺，HR Plus保留收取全额费用的权利。

7. 恶劣天气／不可抗力
如香港天文台或香港特别行政区政府发出八号或以上台风信号、黑色暴雨警告或"极端情况"警告，且于活动预定开始前四（4）小时内仍然生效，或于活动当日中午十二时后取消，活动可予取消或重新安排，客户无须支付任何额外费用。

8. 责任
HR Plus对因本活动而引致的任何损失、损害、索偿或法律责任概不负责，包括但不限于人身伤害、财产损坏或任何间接／相应而生的损失。

9. 接受
客户一经签署本报价单，即确认全面接受本条款及条件，并同意受其约束。

10. 市场推广授权
客户一经签署本报价单，即授予HR Plus非独家、免费的许可，可在其市场推广材料、网站及案例研究中使用客户名称、活动照片及标志。客户可随时以书面通知撤销此授权。

11. 修订
除非以书面方式作出并经双方签署，否则本条款及条件或本报价单的任何修订或更改均不具效力。

12. 适用法律及司法管辖权
本报价单及本条款及条件受香港特别行政区法律管辖并按其解释。因本报价单而产生或与其有关的任何争议，均受香港法院的非专属司法管辖权管辖。

13. 第三方权利
非本报价单一方的人士，无权根据《合约（第三者权利）条例》（第623章）强制执行本报价单的任何条款。`;

export const DEFAULT_REMINDER_TEMPLATE_ZH_HANS = `• 请于到期日前完成付款。
• 付款时请注明发票编号或报价单编号作为付款备注。
• 如对本文件有任何疑问，请与我们联系。`;

// Traditional Chinese, derived automatically from the Simplified masters
// above via OpenCC's phrase-level conversion — same "hk" target and the
// same manually-patched 户→戶 gap documented in recruitmentTerms.ts (OpenCC's
// cn->hk table never converts 户 even inside 客户, so a single global
// replace after conversion is applied here too).
const toTraditionalHK = Converter({ from: "cn", to: "hk" });
export const DEFAULT_TERMS_TEMPLATE_ZH_HANT = toTraditionalHK(DEFAULT_TERMS_TEMPLATE_ZH_HANS).replace(
  /户/g,
  "戶"
);
export const DEFAULT_REMINDER_TEMPLATE_ZH_HANT = toTraditionalHK(DEFAULT_REMINDER_TEMPLATE_ZH_HANS).replace(
  /户/g,
  "戶"
);

export const DEFAULT_TERMS_TEMPLATES: Record<DocumentLanguage, string> = {
  EN: DEFAULT_TERMS_TEMPLATE,
  ZH_HANS: DEFAULT_TERMS_TEMPLATE_ZH_HANS,
  ZH_HANT: DEFAULT_TERMS_TEMPLATE_ZH_HANT,
};

export const DEFAULT_REMINDER_TEMPLATES: Record<DocumentLanguage, string> = {
  EN: DEFAULT_REMINDER_TEMPLATE,
  ZH_HANS: DEFAULT_REMINDER_TEMPLATE_ZH_HANS,
  ZH_HANT: DEFAULT_REMINDER_TEMPLATE_ZH_HANT,
};

const PLACEHOLDER = /\{\{\s*paymentDueDays\s*\}\}/g;

/** Substitute the payment-due-days placeholder into a terms template. */
export function renderTerms(template: string, paymentDueDays: number): string {
  const days = Number.isFinite(paymentDueDays) ? paymentDueDays : DEFAULT_PAYMENT_DUE_DAYS;
  return template.replace(PLACEHOLDER, String(days));
}

function sameDocumentText(a?: string | null, b?: string | null): boolean {
  return (a || "").replace(/\r\n/g, "\n").trim() === (b || "").replace(/\r\n/g, "\n").trim();
}

function asDocumentLanguage(value?: string | null): DocumentLanguage {
  return VALID_DOCUMENT_LANGUAGES.includes(value as DocumentLanguage) ? (value as DocumentLanguage) : "EN";
}

/** When a quotation still uses the standard terms, return that template in
 *  `override`. Hand-edited terms are returned unchanged. */
export function standardTermsForLanguage(
  stored: string | null | undefined,
  paymentDueDays: number,
  override?: string | null
): string | null | undefined {
  if (!override) return stored;
  const target = asDocumentLanguage(override);
  const matchesStandard = VALID_DOCUMENT_LANGUAGES.some((lang) =>
    sameDocumentText(stored, renderTerms(DEFAULT_TERMS_TEMPLATES[lang], paymentDueDays))
  );
  if (!matchesStandard) return stored;
  return renderTerms(DEFAULT_TERMS_TEMPLATES[target], paymentDueDays);
}

/** Same as standardTermsForLanguage, for the reminder block. */
export function standardReminderForLanguage(
  stored: string | null | undefined,
  override?: string | null
): string | null | undefined {
  if (!override) return stored;
  const target = asDocumentLanguage(override);
  const matchesStandard = VALID_DOCUMENT_LANGUAGES.some((lang) =>
    sameDocumentText(stored, DEFAULT_REMINDER_TEMPLATES[lang])
  );
  if (!matchesStandard) return stored;
  return DEFAULT_REMINDER_TEMPLATES[target];
}

/**
 * Returns the document defaults. Today these come from the constants above;
 * when a Settings table exists, fetch overrides here and merge them in.
 */
export function getDocumentDefaults(language: DocumentLanguage = "EN") {
  return {
    paymentDueDays: DEFAULT_PAYMENT_DUE_DAYS,
    termsTemplate: DEFAULT_TERMS_TEMPLATES[language],
    reminderTemplate: DEFAULT_REMINDER_TEMPLATES[language],
  };
}

/** Convenience: fully rendered default terms for a given payment window. */
export function defaultRenderedTerms(
  paymentDueDays = DEFAULT_PAYMENT_DUE_DAYS,
  language: DocumentLanguage = "EN"
): string {
  return renderTerms(DEFAULT_TERMS_TEMPLATES[language], paymentDueDays);
}

// -----------------------------------------------------------------------------
// Email defaults
// -----------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Basic RFC-lite email validation used before attempting to send. */
export function isValidEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

/** Default subject + body for a quotation or invoice email. */
export function defaultEmailContent(args: {
  kind: "Quotation" | "Invoice";
  number: string;
  title?: string | null;
  customerName: string;
  companyName: string;
  /** Public signing link — when set, quotation emails mention reviewing & signing online. */
  signingUrl?: string | null;
  /** Staff Language choice. Omitted calls stay English, so automatic mail is unchanged. */
  language?: AppLanguage;
}) {
  const { kind, number, title, customerName, companyName, signingUrl, language } = args;
  const subjectTitle = title ? ` — ${title}` : "";
  if (language === "zh") {
    const kindLabel = kind === "Invoice" ? "發票" : "報價單";
    const kindWord = kind === "Invoice" ? "發票" : "報價單";
    const subject = `${kindLabel} ${number}${subjectTitle}（${companyName}）`;
    const intro = `請查收附件${kindWord} ${number}${title ? `（${title}）` : ""}。`;
    const callToAction =
      kind === "Invoice"
        ? "請於到期日前安排付款，並以發票編號作為付款參考。"
        : signingUrl
        ? "如需在線查閱並接受此報價單，請使用下方「在線查閱及簽署」連結。您可以查閱全部內容並以電子方式簽署，無需登入。"
        : "如對此報價單有任何問題，歡迎與我們聯絡。";
    const body = `${customerName || "客戶"} 您好：

${intro}

${callToAction}

謝謝。`;
    return { subject, body };
  }
  const subject = `${kind} ${number}${subjectTitle} from ${companyName}`;
  const intro = `Please find attached ${kind === "Invoice" ? "invoice" : "quotation"} ${number}${
    title ? ` for ${title}` : ""
  }.`;
  const callToAction =
    kind === "Invoice"
      ? "Kindly arrange payment before the due date and quote the invoice number as the payment reference."
      : signingUrl
      ? `To review and accept this quotation online, please use the "Review & Sign Online" link below. You'll be able to review the full details and sign electronically — no login required.`
      : "We would be happy to answer any questions you may have regarding this quotation.";

  const body = `Dear ${customerName || "Customer"},

${intro}

${callToAction}

Thank you for your business.`;

  return { subject, body };
}

/**
 * Subject + body for a manual payment follow-up on an unpaid invoice — a
 * firmer nudge than `defaultEmailContent`'s initial-send copy, for staff to
 * send by hand (via the "Send follow-up email" button on the invoice page)
 * when a client hasn't paid yet. Mirrors the wording style of the
 * automatic quotation-signing follow-up in
 * src/app/api/cron/quotation-followups/route.ts, but there's no invoice
 * equivalent of that cron (no `followUpSentAt` field on Invoice) — this is
 * staff-triggered only, so there's no send-once tracking to worry about.
 */
export function followUpEmailContent(args: {
  number: string;
  title?: string | null;
  customerName: string;
  companyName: string;
  dueDate?: string | Date | null;
  overdue?: boolean;
  language?: AppLanguage;
}) {
  const { number, title, customerName, companyName, dueDate, overdue, language } = args;
  const dueDateText = dueDate
    ? new Date(dueDate).toLocaleDateString(language === "zh" ? "zh-HK" : "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  if (language === "zh") {
    const subject = `付款提醒：發票 ${number}${title ? ` — ${title}` : ""}（${companyName}）`;
    const statusLine = overdue
      ? `根據紀錄，發票 ${number}${title ? `（${title}）` : ""} 已經逾期${dueDateText ? `（到期日為 ${dueDateText}）` : ""}。`
      : `提醒你發票 ${number}${title ? `（${title}）` : ""} 尚未付款${dueDateText ? `，到期日為 ${dueDateText}` : ""}。`;
    const body = `${customerName || "客戶"} 您好：

${statusLine}

發票已再次附上，方便查閱。請盡快安排付款，並以發票編號作為付款參考。如已付款，或有任何問題需要協助，請告知我們。

感謝你對 ${companyName} 的支持。`;
    return { subject, body };
  }

  const subject = `Payment reminder: Invoice ${number}${title ? ` — ${title}` : ""} from ${companyName}`;

  const statusLine = overdue
    ? `Our records show invoice ${number}${title ? ` for ${title}` : ""} is now overdue${
        dueDateText ? ` (payment was due on ${dueDateText})` : ""
      }.`
    : `This is a friendly reminder that invoice ${number}${title ? ` for ${title}` : ""} remains unpaid${
        dueDateText ? `, with payment due on ${dueDateText}` : ""
      }.`;

  const body = `Dear ${customerName || "Customer"},

${statusLine}

The invoice is attached again for your convenience — kindly arrange payment at your earliest opportunity and quote the invoice number as the payment reference. Please let us know if payment has already been made, or if there's anything preventing settlement so we can assist.

Thank you for your business with ${companyName}.`;

  return { subject, body };
}

/** Subject + body for emailing an employee their payslip for a given pay period. */
export function payslipEmailContent(args: {
  employeeName: string;
  periodLabel: string;
  companyName: string;
  language?: AppLanguage;
}) {
  const { employeeName, periodLabel, companyName, language } = args;
  if (language === "zh") {
    return {
      subject: `薪資單 — ${periodLabel} — ${companyName}`,
      body: `${employeeName || "同事"} 您好：

請查收附件為 ${periodLabel} 的薪資單。

如對此薪資單有任何問題，請與人力資源部聯絡。

感謝你在 ${companyName} 的工作。`,
    };
  }
  const subject = `Payslip — ${periodLabel} — ${companyName}`;
  const body = `Dear ${employeeName || "Team member"},

Please find attached your payslip for ${periodLabel}.

If you have any questions about this payslip, please get in touch with HR.

Thank you for your work at ${companyName}.`;

  return { subject, body };
}

/** Subject + body for the automatic thank-you sent the moment a client
 *  submits a booking (see POST /api/public/bookings) — every booking is
 *  accepted immediately, so this doubles as the confirmation notice.
 *  Includes a self-service cancelUrl so the client can back out without
 *  contacting staff (see GET/POST on /booking-cancel/[token]). */
export function bookingConfirmedEmailContent(args: {
  clientName: string;
  eventName: string;
  slotLabel: string;
  companyName: string;
  cancelUrl: string;
  manageUrl?: string;
}) {
  const { clientName, eventName, slotLabel, companyName, cancelUrl, manageUrl } = args;
  const subject = `Booking confirmed — ${eventName}`;
  const manageLines = manageUrl
    ? `\nUse the manage link to see the list, change a time, or cancel:\n${manageUrl}\n`
    : "";
  const body = `Dear ${clientName || "Customer"},

Thank you for booking ${eventName} with ${companyName}. Your booking is confirmed for:

${slotLabel}

You can add this to your calendar using the button below.
${manageLines}
If your plans change, you can cancel your booking yourself using the link below:
${cancelUrl}

We look forward to seeing you.

${companyName}`;

  return { subject, body };
}

/** The first email staff send from the event page: the public booking link,
 *  asking the company to choose a time. */
export function bookingInviteEmailContent(args: { eventName: string; companyName: string; bookingUrl: string }) {
  const { eventName, companyName, bookingUrl } = args;
  return {
    subject: `Please book a time — ${eventName}`,
    body: `Hello,

${companyName} has opened booking for ${eventName}. Please open the link and choose a time.

${bookingUrl}

${companyName}`,
  };
}

/** Subject + body for the automatic notice sent when a client submits a
 *  booking against an event with `requiresConfirmation` on — unlike
 *  bookingConfirmedEmailContent, nothing is confirmed yet; staff still have
 *  to review it from the internal admin page. Still includes the cancelUrl,
 *  since a client can withdraw a still-pending request the same way they'd
 *  cancel a confirmed one — see the PATCH on /api/bookings/[id] sending
 *  bookingConfirmedEmailContent for real once staff actually confirm it. */
export function bookingPendingEmailContent(args: {
  clientName: string;
  eventName: string;
  slotLabel: string;
  companyName: string;
  cancelUrl: string;
}) {
  const { clientName, eventName, slotLabel, companyName, cancelUrl } = args;
  const subject = `Booking request received — ${eventName}`;
  const body = `Dear ${clientName || "Customer"},

Thank you for requesting to book ${eventName} with ${companyName}. We've received your request for:

${slotLabel}

This booking is not yet confirmed — we'll follow up shortly to confirm it. If you'd like to withdraw your request in the meantime, you can do so using the link below:
${cancelUrl}

${companyName}`;

  return { subject, body };
}

/** Subject + body for notifying a client that their booking has been
 *  cancelled by staff (see PATCH /api/bookings/[id]) — the "notify" half of
 *  cancel; deleting a booking outright never sends this (see the DELETE
 *  handler on that same route), since deletion is for cleaning up
 *  test/fake requests, not real clients who need to hear about it. */
export function bookingCancelledEmailContent(args: {
  clientName: string;
  slotLabel: string;
  decidedNote?: string | null;
  companyName: string;
}) {
  const { clientName, slotLabel, decidedNote, companyName } = args;
  const subject = `Your booking on ${slotLabel} has been cancelled`;
  const body = `Dear ${clientName || "Customer"},

We're sorry to let you know that your booking for ${slotLabel} has been cancelled.
${decidedNote ? `\nNote from ${companyName}: ${decidedNote}\n` : ""}
Please get in touch or submit a new booking request if you'd like to reschedule.

Thank you for your understanding.

${companyName}`;

  return { subject, body };
}

/** Subject + body sent when a still-PENDING request is turned down (never
 *  having been confirmed) — see bookingCancelledEmailContent above for the
 *  counterpart used once a booking has already been confirmed. */
export function bookingRejectedEmailContent(args: {
  clientName: string;
  slotLabel: string;
  decidedNote?: string | null;
  companyName: string;
}) {
  const { clientName, slotLabel, decidedNote, companyName } = args;
  const subject = `Your booking request for ${slotLabel} could not be confirmed`;
  const body = `Dear ${clientName || "Customer"},

We're sorry to let you know that we're unable to confirm your booking request for ${slotLabel}.
${decidedNote ? `\nNote from ${companyName}: ${decidedNote}\n` : ""}
Please get in touch or submit a new booking request for another time if you'd like to try again.

Thank you for your understanding.

${companyName}`;

  return { subject, body };
}

/** Subject + body for the notification sent after a quotation is signed online. */
export function signedNotificationEmailContent(args: {
  number: string;
  title?: string | null;
  customerName: string;
  signerName: string;
  companyName: string;
}) {
  const { number, title, customerName, signerName, companyName } = args;
  const subject = `Quotation ${number}${title ? ` — ${title}` : ""} — Signed & Accepted`;
  const body = `Quotation ${number}${title ? ` for ${title}` : ""} has been reviewed and signed online by ${signerName} on behalf of ${customerName}.

The signed copy is attached for your records.

Thank you for your business with ${companyName}.`;
  return { subject, body };
}

/** Subject + body sent to HR Plus when a client leaves feedback / requests changes. */
export function clientFeedbackNotificationEmailContent(args: {
  number: string;
  title?: string | null;
  customerName: string;
  commenterName: string;
  message: string;
}) {
  const { number, title, customerName, commenterName, message } = args;
  const subject = `Quotation ${number}${title ? ` — ${title}` : ""} — Client requested changes`;
  const body = `${commenterName} (on behalf of ${customerName}) left feedback on quotation ${number}${
    title ? ` for ${title}` : ""
  } instead of accepting it as-is:

"${message}"

Please review and reply from the quotation page.`;
  return { subject, body };
}

/** Subject + body sent to the client when HR Plus replies on the quotation thread. */
export function staffReplyEmailContent(args: {
  number: string;
  title?: string | null;
  customerName: string;
  companyName: string;
  message: string;
}) {
  const { number, title, customerName, companyName, message } = args;
  const subject = `Quotation ${number}${title ? ` — ${title}` : ""} — Reply from ${companyName}`;
  const body = `Dear ${customerName || "Customer"},

Regarding quotation ${number}${title ? ` for ${title}` : ""}, ${companyName} replied:

"${message}"

You can review the quotation and respond using your original signing link.

Thank you for your business.`;
  return { subject, body };
}

/** Subject + body sent to the client when their signed quotation auto-generates an invoice. */
export function newInvoiceEmailContent(args: {
  number: string;
  title?: string | null;
  customerName: string;
  companyName: string;
  quotationNumber: string;
}) {
  const { number, title, customerName, companyName, quotationNumber } = args;
  const subject = `Invoice ${number}${title ? ` — ${title}` : ""} from ${companyName}`;
  const body = `Dear ${customerName || "Customer"},

Thank you for accepting quotation ${quotationNumber}. Invoice ${number}${
    title ? ` for ${title}` : ""
  } is attached for your records.

To review the invoice online and let us know once you've paid, please use the "View & Pay Invoice Online" link below.

Thank you for your business.`;
  return { subject, body };
}
export function paymentSubmittedNotificationEmailContent(args: {
  number: string;
  title?: string | null;
  customerName: string;
  submitterName: string;
  submitterEmail: string;
  total: number;
  currency: string;
}) {
  const { number, title, customerName, submitterName, submitterEmail, total, currency } = args;
  const subject = `Invoice ${number}${title ? ` — ${title}` : ""} — Marked as paid, please verify`;
  const body = `${submitterName} (${submitterEmail}) marked invoice ${number}${
    title ? ` for ${title}` : ""
  } as paid on behalf of ${customerName}.

Amount: ${currency} ${total.toLocaleString()}

Please verify the payment landed in the bank account, then mark the invoice as Paid from the invoice page — this will automatically generate and email the receipt to the client.`;
  return { subject, body };
}

/** Subject + body sent to the client with their receipt attached, once HR Plus verifies payment. */
export function receiptEmailContent(args: {
  receiptNumber: string;
  invoiceNumber: string;
  title?: string | null;
  customerName: string;
  companyName: string;
}) {
  const { receiptNumber, invoiceNumber, title, customerName, companyName } = args;
  const subject = `Receipt ${receiptNumber} for Invoice ${invoiceNumber}${title ? ` — ${title}` : ""}`;
  const body = `Dear ${customerName || "Customer"},

Thank you for your payment. Please find attached receipt ${receiptNumber} confirming payment of invoice ${invoiceNumber}${
    title ? ` for ${title}` : ""
  }.

Thank you for your business with ${companyName}.`;
  return { subject, body };
}
