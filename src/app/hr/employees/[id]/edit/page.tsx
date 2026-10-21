import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmployeeForm from "@/components/EmployeeForm";
import { canManageEmployee } from "@/lib/documentAccess";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const t = getT();
  // Pre-fills every field, including HKID/bank/salary — admin-only.
  if (!(await canManageEmployee(params.id))) redirect("/hr/profile");

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      // Only the bits the work-location/hours section on this page needs —
      // that section is its own lightweight edit path (see EmployeeForm),
      // separate from the full contract letter form.
      contract: { select: { id: true, status: true, workLocation: true, workSchedule: true } },
    },
  });
  if (!employee) notFound();
  const companies = await prisma.employerCompany.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">
          {t("Edit {name}", { name: employee.name })}
        </h1>
      </div>
      <EmployeeForm
        companies={companies}
        contract={employee.contract}
        employee={{
          ...employee,
          // Passed separately as the `contract` prop above instead (a
          // narrower select just for the work-location/hours section) — omit
          // it here so it doesn't shadow the full EmployeeContract shape the
          // Employee type expects.
          contract: undefined,
          employmentType: employee.employmentType as any,
          payRateType: employee.payRateType as any,
          status: employee.status as any,
          startDate: employee.startDate ? employee.startDate.toISOString() : null,
          birthday: employee.birthday ? employee.birthday.toISOString() : null,
          lastDay: employee.lastDay ? employee.lastDay.toISOString() : null,
          onboardingSentAt: employee.onboardingSentAt ? employee.onboardingSentAt.toISOString() : null,
          onboardingCompletedAt: employee.onboardingCompletedAt
            ? employee.onboardingCompletedAt.toISOString()
            : null,
          createdAt: employee.createdAt.toISOString(),
          updatedAt: employee.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}
