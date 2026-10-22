import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { isValidEmail } from "@/lib/settings";
import { ensureOnboardingToken, onboardingUrlFor } from "@/lib/signing";
import { sendDocumentEmail } from "@/lib/mailer";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// (Re)sends the onboarding invite for an existing employee record — covers
// both "the first send from /api/employees/invite failed" and "it's been a
// while, please resend." Blocked once onboarding is already complete: the
// public link is locked server-side regardless, so resending at that point
// would just be a confusing email with no way to act on it.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      personalEmail: true,
      companyEmail: true,
      onboardingCompletedAt: true,
    },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  if (employee.onboardingCompletedAt) {
    return NextResponse.json(
      { error: "This employee has already completed onboarding." },
      { status: 409 }
    );
  }
  const to = [employee.email, employee.personalEmail, employee.companyEmail].find(
    (address) => address && isValidEmail(address)
  );
  if (!to) {
    return NextResponse.json(
      { error: "This employee doesn't have a valid email address on file yet." },
      { status: 400 }
    );
  }

  const token = await ensureOnboardingToken(employee.id);
  const onboardingUrl = token ? onboardingUrlFor(token, request) : null;
  if (!onboardingUrl) {
    return NextResponse.json({ error: "Could not generate an onboarding link." }, { status: 500 });
  }

  try {
    await sendDocumentEmail({
      to,
      subject: "Reminder — please complete your onboarding details",
      body: `Hi ${employee.name},\n\nPlease click the button below to fill in your personal details for our records. This only needs to be done once.`,
      signingUrl: onboardingUrl,
      ctaLabel: "Fill in my details",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send the onboarding email." },
      { status: 502 }
    );
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { onboardingSentAt: new Date() },
  });

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "EMAIL_SENT",
    description: `Onboarding invite emailed to ${to}`,
  });

  return NextResponse.json({ success: true, sentTo: to });
}
