import { NextRequest, NextResponse } from "next/server";
import { sendDocumentEmail, parseDataUrl } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { markCvEmailSent, saveCvEmail } from "@/lib/cvEmail";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAIL_TAGS = /^(b|strong|i|em|u|ul|ol|li|br|p|div|span)$/i;

function sanitizeMailHtml(html: string): string {
  return String(html || "").replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag) => {
    if (!MAIL_TAGS.test(tag)) return "";
    const name = String(tag).toLowerCase();
    if (full.startsWith("</")) return "</" + name + ">";
    return name === "br" ? "<br>" : "<" + name + ">";
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const to = String(body.to || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Please enter a valid recipient email address." }, { status: 400 });
  }
  const subject = String(body.subject || "").trim();
  const text = String(body.body || "").trim();
  if (!subject || !text) {
    return NextResponse.json({ error: "Email subject and body are required." }, { status: 400 });
  }

  const raw = Array.isArray(body.attachments) ? body.attachments : [];
  if (raw.length > MAX_FILES) {
    return NextResponse.json({ error: "You can attach up to 8 CVs." }, { status: 400 });
  }
  const extraAttachments = [];
  for (const item of raw) {
    if (!item || typeof item.data !== "string") continue;
    const parsed = parseDataUrl(item.data);
    if (!parsed) continue;
    const filename = (typeof item.filename === "string" && item.filename.trim()) || "CV";
    if (parsed.buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `"${filename}" is larger than 8MB.` }, { status: 400 });
    }
    extraAttachments.push({ filename, content: parsed.buffer, contentType: parsed.contentType });
  }
  if (!extraAttachments.length) {
    return NextResponse.json({ error: "Choose at least one candidate CV to attach." }, { status: 400 });
  }

  try {
    // Same SMTP path as an invoice: Settings standing CC, company signature, and attachments.
    await sendDocumentEmail({
      to,
      subject,
      body: text,
      htmlBody: sanitizeMailHtml(String(body.bodyHtml || "")),
      extraAttachments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send the email." }, { status: 502 });
  }

  try {
    const candidates = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 8).map((item: unknown) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const cv = row.cv && typeof row.cv === "object" ? (row.cv as Record<string, unknown>) : {};
      return {
        id: String(row.id || ""),
        format: row.format === "docx" ? "docx" : "pdf",
        name: String(row.name || cv.candidate || ""),
      };
    });
    const saved = await saveCvEmail({
      id: typeof body.id === "string" ? body.id : "",
      to,
      company: String(body.company || ""),
      position: String(body.position || ""),
      subject,
      bodyHtml: String(body.bodyHtml || ""),
      candidates,
    });
    await markCvEmailSent(saved.id);
  } catch {
    // The message already went out. A missed status update should not look like a failed send.
  }
  return NextResponse.json({ success: true, to });
}
