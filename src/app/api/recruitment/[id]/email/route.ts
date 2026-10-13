import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildRecruitmentAgreementPdf } from "@/lib/pdf/build";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { ensureRecruitmentSigningToken, recruitmentSigningUrlFor } from "@/lib/signing";
import { extraAttachmentsFrom } from "@/lib/emailAttachments";
import { logActivity } from "@/lib/activity";
import { pdfFileName, pdfLanguageFromBody, pdfLanguageLabel } from "@/lib/pdf/language";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));

  const pdfLanguage = pdfLanguageFromBody(body.pdfLanguage);
  const built = await buildRecruitmentAgreementPdf(params.id, pdfLanguage);
  if (!built) {
    return NextResponse.json({ error: "Recruitment agreement not found." }, { status: 404 });
  }

  const to = (body.to || built.companyEmail || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "The client's email address is missing or invalid." },
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

  // Every agreement email carries a secure, tokenized link to the public
  // signing page so the client can review and sign online.
  const token = await ensureRecruitmentSigningToken(params.id);
  const signingUrl = token ? recruitmentSigningUrlFor(token, request) : undefined;

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
      ctaLabel: "Review & Sign Online",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send the email." },
      { status: 502 }
    );
  }

  await logActivity({
    documentType: "recruitment",
    documentId: params.id,
    type: "EMAIL_SENT",
    description: `Emailed to ${to} (${pdfLanguageLabel(pdfLanguage || built.data.language)})`,
  });

  // Sending the agreement for the first time moves it from Draft to Sent.
  const current = await prisma.recruitmentAgreement.findUnique({
    where: { id: params.id },
    select: { status: true },
  });
  if (current?.status === "DRAFT") {
    await prisma.recruitmentAgreement.update({ where: { id: params.id }, data: { status: "SENT" } });
  }

  return NextResponse.json({ success: true, to, signingUrl });
}
