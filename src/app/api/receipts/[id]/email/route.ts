import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReceiptPdf } from "@/lib/pdf/build";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { extraAttachmentsFrom } from "@/lib/emailAttachments";
import { logActivity } from "@/lib/activity";
import { pdfFileName, pdfLanguageFromBody, pdfLanguageLabel } from "@/lib/pdf/language";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const pdfLanguage = pdfLanguageFromBody(body.pdfLanguage);
  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    select: { invoiceId: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const built = await buildReceiptPdf(receipt.invoiceId, pdfLanguage);
  if (!built) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const to = (body.to || built.customerEmail || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "The customer's email address is missing or invalid." }, { status: 400 });
  }
  if (!body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "Email subject and body are required." }, { status: 400 });
  }

  const ccList = (Array.isArray(body.cc) ? body.cc : body.cc ? [body.cc] : [])
    .map((e: unknown) => (typeof e === "string" ? e.trim() : ""))
    .filter(Boolean);
  if (ccList.some((e: string) => !isValidEmail(e))) {
    return NextResponse.json({ error: "One of the CC email addresses is invalid." }, { status: 400 });
  }

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
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send the email." }, { status: 502 });
  }

  await logActivity({
    documentType: "invoice",
    documentId: receipt.invoiceId,
    type: "EMAIL_SENT",
    description: `Receipt emailed to ${to} (${pdfLanguageLabel(pdfLanguage || built.data.language)})`,
  });

  return NextResponse.json({ success: true, to });
}
