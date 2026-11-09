import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { ensureMpfFormColumns, ensureMpfFormToken, mpfDoneUrlFor, mpfEmailBody, mpfFormUrlFor, MPF_FORM_FILENAME, readIndividualEmpfForm } from "@/lib/mpfForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Email the Individual eMPF Form and the private upload link. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const to = (employee.personalEmail || employee.email || "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "This employee has no email address." }, { status: 400 });
  }

  const token = await ensureMpfFormToken(employee.id);
  if (!token) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  let form: Buffer;
  try {
    form = readIndividualEmpfForm();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "The Individual eMPF Form file is missing." }, { status: 500 });
  }

  try {
    await sendDocumentEmail({
      to,
      subject: "Individual eMPF Form",
      body: mpfEmailBody(employee.name),
      attachment: { filename: MPF_FORM_FILENAME, content: form },
      signingUrl: mpfDoneUrlFor(token, request),
      ctaLabel: "I have finished eMPF registration",
      secondaryCtaUrl: mpfFormUrlFor(token, request),
      secondaryCtaLabel: "Upload Individual eMPF Form",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send the email." }, { status: 502 });
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { mpfFormSentAt: new Date() },
  });
  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "EMAIL_SENT",
    description: `Individual eMPF Form emailed to ${to}`,
  });

  return NextResponse.json({ success: true, to });
}
