import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { buildEmployeeContractPdf } from "@/lib/pdf/build";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { ensureEmployeeContractSigningToken, employeeContractSigningUrlFor } from "@/lib/signing";
import { contractDocumentTitleFor } from "@/lib/employeeContractTerms";
import { extraAttachmentsFrom } from "@/lib/emailAttachments";
import { logActivity } from "@/lib/activity";
import { pdfLanguageFromBody, pdfLanguageLabel, pdfLanguageSuffix } from "@/lib/pdf/language";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Send the contract letter to the employee for online e-signature — same
 *  build-PDF -> mint-token -> email -> log -> flip-status pattern as the
 *  recruitment agreement's send route. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { contract: true },
  });
  if (!employee || !employee.contract) {
    return NextResponse.json({ error: "This employee has no contract yet." }, { status: 404 });
  }

  const pdfLanguage = pdfLanguageFromBody(body.pdfLanguage);
  const built = await buildEmployeeContractPdf(params.id, pdfLanguage);
  if (!built) {
    return NextResponse.json({ error: "Could not generate the contract PDF." }, { status: 500 });
  }

  const to = (body.to || employee.personalEmail || employee.email || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "The employee's email address is missing or invalid." },
      { status: 400 }
    );
  }

  const token = await ensureEmployeeContractSigningToken(employee.contract.id);
  const signingUrl = token ? employeeContractSigningUrlFor(token, request) : undefined;
  const documentTitle = contractDocumentTitleFor(employee.employmentType);

  let extraAttachments;
  try {
    extraAttachments = extraAttachmentsFrom(body.attachments);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    await sendDocumentEmail({
      to,
      subject: body.subject?.trim() || `Your ${documentTitle.toLowerCase()} with us`,
      body:
        body.body ||
        `Hi ${employee.name},\n\nPlease review and sign your ${documentTitle.toLowerCase()} using the button below.`,
      attachment: {
        filename: `${employee.name.replace(/\s+/g, "-")}-contract${pdfLanguageSuffix(pdfLanguage)}.pdf`,
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
    documentType: "employee",
    documentId: employee.id,
    type: "EMAIL_SENT",
    description: `Contract emailed to ${to} (${pdfLanguageLabel(pdfLanguage)})`,
  });

  if (employee.contract.status === "DRAFT") {
    await prisma.employeeContract.update({ where: { id: employee.contract.id }, data: { status: "SENT" } });
  }

  return NextResponse.json({ success: true, to, signingUrl });
}
