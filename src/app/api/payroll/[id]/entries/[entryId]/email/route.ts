import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { buildPayslipPdf } from "@/lib/pdf/build";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { extraAttachmentsFrom } from "@/lib/emailAttachments";
import { logActivity } from "@/lib/activity";
import { pdfLanguageFromBody, pdfLanguageLabel, pdfLanguageSuffix } from "@/lib/pdf/language";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  const pdfLanguage = pdfLanguageFromBody(body.pdfLanguage);
  const built = await buildPayslipPdf(params.id, params.entryId, pdfLanguage);
  if (!built) {
    return NextResponse.json({ error: "Payslip not found." }, { status: 404 });
  }

  const to = (body.to || built.employeeEmail || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "The employee's email address is missing or invalid." },
      { status: 400 }
    );
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
        filename: `${built.employeeName} - ${built.periodLabel}${pdfLanguageSuffix(pdfLanguage)}.pdf`,
        content: built.buffer,
      },
      extraAttachments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send the email." }, { status: 502 });
  }

  await prisma.payrollEntry.update({
    where: { id: params.entryId },
    data: { payslipSentAt: new Date() },
  });

  await logActivity({
    documentType: "payroll",
    documentId: params.id,
    type: "EMAIL_SENT",
    description: `Payslip for ${built.periodLabel} emailed to ${built.employeeName} (${to}, ${pdfLanguageLabel(pdfLanguage)})`,
  });

  return NextResponse.json({ success: true, to });
}
