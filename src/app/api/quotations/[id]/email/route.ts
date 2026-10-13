import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildQuotationPdf } from "@/lib/pdf/build";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { ensureSigningToken, signingUrlFor } from "@/lib/signing";
import { extraAttachmentsFrom } from "@/lib/emailAttachments";
import { logActivity } from "@/lib/activity";
import { pdfFileName, pdfLanguageFromBody, pdfLanguageLabel } from "@/lib/pdf/language";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));

  const pdfLanguage = pdfLanguageFromBody(body.pdfLanguage);
  const built = await buildQuotationPdf(params.id, pdfLanguage);
  if (!built) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  const to = (body.to || built.customerEmail || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "The customer's email address is missing or invalid." },
      { status: 400 }
    );
  }
  if (!body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "Email subject and body are required." }, { status: 400 });
  }

  // A one-off CC list for this send only — case by case, on top of any
  // standing CC configured in Settings (merged in sendDocumentEmail).
  const ccList = (Array.isArray(body.cc) ? body.cc : body.cc ? [body.cc] : [])
    .map((e: unknown) => (typeof e === "string" ? e.trim() : ""))
    .filter(Boolean);
  if (ccList.some((e: string) => !isValidEmail(e))) {
    return NextResponse.json({ error: "One of the CC email addresses is invalid." }, { status: 400 });
  }

  // Every quotation email carries a secure, tokenized link to the public
  // signing page so the client can review and accept online.
  const token = await ensureSigningToken(params.id);
  const signingUrl = token ? signingUrlFor(token, request) : undefined;

  let extraAttachments;
  try {
    extraAttachments = extraAttachmentsFrom(body.attachments);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    await sendDocumentEmail({
      to,
      cc: ccList,
      subject: body.subject.trim(),
      body: body.body,
      attachment: {
        filename: pdfFileName(built.number, pdfLanguage || built.data.language),
        content: built.buffer,
      },
      extraAttachments,
      signingUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send the email." },
      { status: 502 }
    );
  }

  await logActivity({
    documentType: "quotation",
    documentId: params.id,
    type: "EMAIL_SENT",
    description: `Emailed to ${to} (${pdfLanguageLabel(pdfLanguage || built.data.language)})`,
  });

  // Sending the quotation for the first time moves it from Draft to Sent.
  // Either way, a fresh manual send resets the follow-up clock — the next
  // automatic reminder (see /api/cron/quotation-followups) should count 7
  // days from *this* send, not whenever it first went out.
  const current = await prisma.quotation.findUnique({
    where: { id: params.id },
    select: { status: true },
  });
  await prisma.quotation.update({
    where: { id: params.id },
    data: {
      status: current?.status === "DRAFT" ? "SENT" : undefined,
      followUpSentAt: null,
    },
  });

  return NextResponse.json({ success: true, to, signingUrl });
}
