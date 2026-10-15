import nodemailer from "nodemailer";
import { COMPANY } from "@/lib/company";
import { getEffectiveCompany, getEffectiveCc } from "@/lib/appSettings";

type Company = typeof COMPANY;

/**
 * SMTP transport built from environment variables. Configure these in
 * `.env` (see `.env.example`):
 *
 *   SMTP_HOST      e.g. smtp.gmail.com
 *   SMTP_PORT      e.g. 587
 *   SMTP_SECURE    "true" for port 465, otherwise "false"
 *   SMTP_USER      login / username
 *   SMTP_PASS      password or app-password
 *   SMTP_FROM      From header, e.g. "HR Plus <billing@hrplus.info>"
 *
 * If SMTP is not configured, `sendDocumentEmail` throws a clear error so the
 * UI can tell the user to set it up — nothing is silently dropped.
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!isMailConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Brand palette (mirrors tailwind.config.js) — email clients can't read
// Tailwind classes or CSS variables, so these are the same hex values
// hard-coded for use in inline styles.
const BRAND = {
  ink: "#1B2436",
  inkMuted: "#66708A",
  inkFaint: "#9AA3B8",
  paper: "#F5F7FC",
  line: "#E3E8F3",
  brand500: "#4F7CFF",
  brand600: "#3D63E0",
  brand700: "#2F4FBD",
  accent500: "#9B6BEA",
  gradient: "linear-gradient(135deg, #4F7CFF 0%, #7F9BFA 45%, #9B6BEA 100%)",
};

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Wraps the email content in a modern SaaS-style card: a light paper
 * background, a centered white card with a brand-gradient accent stripe
 * along the top, generous padding, and a muted legal line underneath. Built
 * with a table for the outer structure (better rendering across older
 * Outlook/webmail clients) and inline styles throughout, since email clients
 * don't load external stylesheets.
 */
function emailShell(innerHtml: string, company: Company, logoCid?: string | null): string {
  return `
  <div style="background-color:${BRAND.paper};padding:32px 16px;font-family:${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
      <tr>
        <td style="background-color:#ffffff;border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="height:5px;line-height:5px;font-size:0;background-color:${BRAND.brand500};background-image:${BRAND.gradient};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 36px 8px;">
                ${emailHeaderHtml(company, logoCid)}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 32px;font-size:14.5px;line-height:1.7;color:${BRAND.ink};">
                ${innerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 12px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:${BRAND.inkFaint};">
            Sent by ${company.name}${
    company.website ? ` · <a href="${company.website}" style="color:${BRAND.inkFaint};text-decoration:underline;">${company.website.replace(/^https?:\/\//, "")}</a>` : ""
  }
          </p>
        </td>
      </tr>
    </table>
  </div>`;
}

/**
 * Parse a `data:<mime>;base64,<payload>` URL (the format company logos, and
 * user-picked email attachments, are stored in) into its content type and
 * raw bytes. Returns null for anything else so a malformed value never
 * blocks sending. Exported for src/lib/emailAttachments.ts.
 */
export function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

/**
 * Small header row: logo (or company name as text fallback). Most webmail
 * clients (Gmail included) strip `data:` URI images out of HTML email as a
 * security measure, so the logo has to be sent as a real inline attachment
 * and referenced by its Content-ID (`cid:`) instead — see logoCid handling
 * in sendDocumentEmail below.
 */
function emailHeaderHtml(company: Company, logoCid?: string | null): string {
  if (logoCid) {
    return `<img src="cid:${logoCid}" alt="${company.name}" height="28" style="height:28px;display:block;" />`;
  }
  if (company.logoData) {
    return `<img src="${company.logoData}" alt="${company.name}" height="28" style="height:28px;display:block;" />`;
  }
  return `<span style="font-size:18px;font-weight:700;color:${BRAND.brand700};">${company.name}</span>`;
}

/** Professional email signature, appended to outgoing messages. */
export function emailSignatureHtml(company: Company): string {
  const c = company.contact;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse;">
      <tr>
        <td style="width:3px;background-color:${BRAND.brand500};background-image:${BRAND.gradient};border-radius:2px;"></td>
        <td style="padding-left:14px;font-size:13px;line-height:1.6;color:${BRAND.inkMuted};">
          <strong style="font-size:14px;color:${BRAND.ink};">${company.shortName || company.name}</strong><br/>
          <span>${c.name}${c.title ? " — " + c.title : ""}</span><br/>
          ${c.tel ? `<span>Tel: ${c.tel}</span><br/>` : ""}
          ${c.email ? `<span>Email: <a href="mailto:${c.email}" style="color:${BRAND.brand600};text-decoration:none;">${c.email}</a></span><br/>` : ""}
          <span style="color:${BRAND.inkFaint};font-size:12px;">${company.name}</span>
        </td>
      </tr>
    </table>`;
}

export function emailSignatureText(company: Company): string {
  const c = company.contact;
  return [
    "",
    "--",
    company.shortName || company.name,
    `${c.name}${c.title ? " — " + c.title : ""}`,
    c.tel ? `Tel: ${c.tel}` : "",
    c.email ? `Email: ${c.email}` : "",
    company.name,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Turn a plain-text body into simple HTML (paragraphs + line breaks). The
 *  first paragraph is almost always the opening greeting ("Hi {name},") —
 *  every caller in this app starts its body that way — so it gets its own
 *  larger, warmer-colored treatment instead of blending into the rest of
 *  the copy. That's what actually makes the email read as a friendly note
 *  rather than a formal notice, more than any single wording change would. */
function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((p, i) =>
      i === 0
        ? `<p style="margin:0 0 18px;font-size:21px;line-height:1.4;font-weight:600;color:${BRAND.brand600};">${p.replace(/\n/g, "<br/>")}</p>`
        : `<p style="margin:0 0 14px;color:${BRAND.ink};">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

export type SendArgs = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  attachment?: { filename: string; content: Buffer };
  /** Additional files beyond `attachment` — e.g. a client-uploaded signed
   *  document alongside the regenerated quotation PDF. */
  extraAttachments?: { filename: string; content: Buffer; contentType?: string }[];
  /** When set, a prominent call-to-action button/link is added to the email. */
  signingUrl?: string;
  /** Label for the CTA button — defaults to "Review & Sign Online". */
  ctaLabel?: string;
  /** A second, independent CTA button — e.g. "Add to Google Calendar" on a
   *  booking confirmation, alongside the primary signingUrl button (or on its
   *  own when there's no signingUrl at all). Rendered the same way, just
   *  after the first one. */
  secondaryCtaUrl?: string;
  secondaryCtaLabel?: string;
};

/** Styled call-to-action button + fallback plain link for the signing/payment email. */
function signingCtaHtml(url: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;width:100%;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td align="center" style="border-radius:999px;background-color:${BRAND.brand500};background-image:${BRAND.gradient};box-shadow:0 8px 20px rgba(79,124,255,0.28);">
                <a href="${url}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                  ${label}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:${BRAND.inkFaint};text-align:center;margin:0 0 4px;">
      Or copy this link into your browser:
    </p>
    <p style="font-size:12px;text-align:center;margin:0 0 8px;word-break:break-all;">
      <a href="${url}" style="color:${BRAND.brand600};">${url}</a>
    </p>`;
}

function signingCtaText(url: string, label: string): string {
  return `\n${label}: ${url}\n`;
}

/**
 * Send a document email with the PDF attached and the HR Plus signature
 * appended. Throws if SMTP is not configured or if sending fails.
 */
export async function sendDocumentEmail({
  to,
  cc,
  subject,
  body,
  attachment,
  extraAttachments,
  signingUrl,
  ctaLabel = "Review & Sign Online",
  secondaryCtaUrl,
  secondaryCtaLabel = "Add to Calendar",
}: SendArgs) {
  const transport = getTransport();
  if (!transport) {
    throw new Error(
      "Email is not configured on the server. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (see .env.example)."
    );
  }

  const [company, standingCc] = await Promise.all([getEffectiveCompany(), getEffectiveCc()]);

  const from =
    process.env.SMTP_FROM || `${company.name} <${company.email || process.env.SMTP_USER}>`;

  // CC the standing recipients configured on the Settings page (unless
  // CC'ing is turned off there), in addition to any explicit cc.
  const ccList = [
    ...(Array.isArray(cc) ? cc : cc ? [cc] : []),
    ...standingCc,
  ].filter((e, i, arr) => e && arr.indexOf(e) === i);

  // Inline the logo as a real attachment referenced by Content-ID rather
  // than a `data:` URI in the <img> src — Gmail and most other webmail
  // clients silently strip data: URI images from HTML email, which is why
  // the logo wasn't showing up.
  const logoAsset = company.logoData ? parseDataUrl(company.logoData) : null;
  const logoCid = logoAsset ? "company-logo" : null;

  const innerHtml = `${bodyToHtml(body)}${
    signingUrl ? signingCtaHtml(signingUrl, ctaLabel) : ""
  }${secondaryCtaUrl ? signingCtaHtml(secondaryCtaUrl, secondaryCtaLabel) : ""}${emailSignatureHtml(company)}`;

  await transport.sendMail({
    from,
    to,
    cc: ccList.length ? ccList : undefined,
    subject,
    text: `${body}\n${signingUrl ? signingCtaText(signingUrl, ctaLabel) : ""}${
      secondaryCtaUrl ? signingCtaText(secondaryCtaUrl, secondaryCtaLabel) : ""
    }${emailSignatureText(company)}`,
    html: emailShell(innerHtml, company, logoCid),
    attachments: [
      ...(logoAsset
        ? [
            {
              filename: `logo.${(logoAsset.contentType.split("/")[1] || "png").split("+")[0]}`,
              content: logoAsset.buffer,
              contentType: logoAsset.contentType,
              cid: logoCid!,
              contentDisposition: "inline" as const,
            },
          ]
        : []),
      ...(attachment
        ? [{ filename: attachment.filename, content: attachment.content, contentType: "application/pdf" }]
        : []),
      ...(extraAttachments || []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/pdf",
      })),
    ],
  });
}
