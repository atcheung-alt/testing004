import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { VALID_EMPLOYMENT_TYPES, PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE, hasAnnualLeaveEntitlement } from "@/lib/employees";

export const dynamic = "force-dynamic";

/**
 * Open a new employment record for someone who already left. The former
 * record is left untouched — payroll, leave, and the old contract stay on
 * it — and this new row points back at it so both stints show in history.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const previous = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { laterEmployment: { select: { id: true } } },
  });
  if (!previous) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (previous.status !== "FORMER") {
    return NextResponse.json({ error: "Only a former employee can rejoin." }, { status: 400 });
  }
  if (previous.laterEmployment) {
    return NextResponse.json(
      { error: "This person already has a later employment record." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const startDate = body.startDate ? new Date(body.startDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "A new start date is required." }, { status: 400 });
  }

  const employmentType =
    typeof body.employmentType === "string" && VALID_EMPLOYMENT_TYPES.includes(body.employmentType)
      ? body.employmentType
      : previous.employmentType;
  const allowedPayRateTypes = employmentType ? PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE[employmentType] : undefined;
  const payRateType =
    typeof body.payRateType === "string" && allowedPayRateTypes?.includes(body.payRateType)
      ? body.payRateType
      : allowedPayRateTypes?.includes(previous.payRateType || "")
        ? previous.payRateType
        : null;

  let companyId: string | null = previous.companyId;
  if (body.companyId !== undefined) {
    companyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
  }
  if (companyId) {
    const company = await prisma.employerCompany.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "That company doesn't exist." }, { status: 400 });
  }

  const nickname =
    typeof body.nickname === "string"
      ? body.nickname.trim().slice(0, 40) || null
      : previous.nickname;

  const employee = await prisma.employee.create({
    data: {
      name: previous.name,
      surnameEn: previous.surnameEn,
      givenNameEn: previous.givenNameEn,
      preferredName: previous.preferredName,
      nickname,
      title: typeof body.title === "string" ? body.title.trim() : previous.title,
      salary: body.salary !== undefined ? Number(body.salary) || 0 : previous.salary,
      payRateType,
      payRate: payRateType ? (body.payRate !== undefined ? Number(body.payRate) || 0 : previous.payRate) : 0,
      annualLeaveDays: hasAnnualLeaveEntitlement(employmentType) ? previous.annualLeaveDays : 0,
      startDate,
      hkid: previous.hkid,
      address: previous.address,
      gender: previous.gender,
      birthday: previous.birthday,
      bankName: previous.bankName,
      bankAccount: previous.bankAccount,
      bankCardName: previous.bankCardName,
      bankCode: previous.bankCode,
      status: "ACTIVE",
      employmentType,
      companyEmail: previous.companyEmail,
      email: previous.email,
      nameChinese: previous.nameChinese,
      surnameChinese: previous.surnameChinese,
      givenNameChinese: previous.givenNameChinese,
      nationality: previous.nationality,
      phone: previous.phone,
      personalEmail: previous.personalEmail,
      emergencyContactName: previous.emergencyContactName,
      emergencyContactRelationship: previous.emergencyContactRelationship,
      emergencyContactPhone: previous.emergencyContactPhone,
      onboardingCompletedAt: previous.onboardingCompletedAt,
      declarationAccuracy: previous.declarationAccuracy,
      declarationConsent: previous.declarationConsent,
      companyId,
      priorEmployeeId: previous.id,
    },
  });

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "CREATED",
    description: `Rejoined — new record for ${employee.name}, previous record kept`,
  });
  await logActivity({
    documentType: "employee",
    documentId: previous.id,
    type: "EDITED",
    description: `${previous.name} rejoined on a new employment record`,
  });

  return NextResponse.json(employee, { status: 201 });
}
