import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { getManualOnboardingCompletionIssues } from "@/lib/employees";
import { logActivity } from "@/lib/activity";
import { scheduleMpfEmail } from "@/lib/mpfForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lets an admin mark onboarding as complete for an employee who was added
// directly via the "New employee" form and never sent an invite link — the
// public onboarding flow (src/app/api/public/onboarding/[token]/submit) is
// the only other place onboardingCompletedAt ever gets set, and a manually
// created employee has no token to reach it through. Restricted to
// never-invited employees so it can't be used to bypass a real invite that's
// still in flight, and gated on the mandatory fields in
// getManualOnboardingCompletionIssues (HKID, address, surname/given name,
// birthday, salary or pay rate, annual leave entitlement, employment type,
// title, start date, bank name, bank account number) so a contract can't be
// generated off an incomplete record.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      onboardingSentAt: true,
      onboardingCompletedAt: true,
      surnameEn: true,
      givenNameEn: true,
      hkid: true,
      address: true,
      birthday: true,
      title: true,
      employmentType: true,
      salary: true,
      payRateType: true,
      payRate: true,
      annualLeaveDays: true,
      startDate: true,
      bankName: true,
      bankAccount: true,
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
  if (employee.onboardingSentAt) {
    return NextResponse.json(
      {
        error:
          "An onboarding invite was already sent to this employee — use that link instead of completing it manually.",
      },
      { status: 409 }
    );
  }

  const issues = getManualOnboardingCompletionIssues(employee);
  if (issues.length > 0) {
    return NextResponse.json(
      { error: `Fill in the following before marking onboarding complete: ${issues.join(", ")}.` },
      { status: 400 }
    );
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { onboardingCompletedAt: new Date() },
  });

  try {
    await scheduleMpfEmail(employee.id);
  } catch (err) {
    console.error("[onboarding] could not schedule the MPF email", err);
  }

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "ONBOARDING_SUBMITTED",
    description: "Onboarding marked complete manually (employee added directly, all details on file).",
  });

  return NextResponse.json({ success: true });
}
