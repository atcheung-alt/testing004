import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/documentAccess";
import { getEffectiveCompany } from "@/lib/appSettings";
import { getContractPrerequisiteIssues } from "@/lib/employees";
import EmployeeContractForm from "@/components/EmployeeContractForm";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EmployeeContractPage({ params }: { params: { id: string } }) {
  const t = getT();
  if (!(await canManageEmployee(params.id))) redirect("/hr/profile");

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { contract: true },
  });
  if (!employee) notFound();

  // Once a contract has been sent, its fields are edited from the read-only
  // detail card on the employee page instead (send/verify actions only) —
  // this form is only for drafting or fixing a not-yet-sent letter.
  if (employee.contract && employee.contract.status !== "DRAFT") {
    notFound();
  }

  // Belt-and-braces: the employee detail page already hides the "Create
  // contract" link until every prerequisite is filled in, but this page is
  // still reachable directly by URL — so a brand-new contract still can't
  // be started here until those same checks pass. Editing an existing
  // draft is never blocked this way, since that draft already exists.
  if (!employee.contract) {
    const issues = getContractPrerequisiteIssues(employee);
    if (issues.length > 0) {
      redirect(`/hr/employees/${employee.id}`);
    }
  }

  const company = await getEffectiveCompany();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">
          {employee.contract
            ? t("Edit contract for {name}", { name: employee.name })
            : t("Create contract for {name}", { name: employee.name })}
        </h1>
      </div>
      <EmployeeContractForm
        employeeId={employee.id}
        employeeName={employee.name}
        employeeTitle={employee.title}
        salary={employee.salary}
        employmentType={employee.employmentType}
        payRateType={employee.payRateType}
        payRate={employee.payRate}
        annualLeaveDays={employee.annualLeaveDays}
        startDate={employee.startDate ? employee.startDate.toISOString() : null}
        hkid={employee.hkid}
        employeeAddress={employee.address}
        gender={employee.gender}
        companyName={company.name}
        companyAddress={company.address}
        contract={
          employee.contract
            ? {
                id: employee.contract.id,
                terms: employee.contract.terms,
                probationPeriod: employee.contract.probationPeriod,
                contractEndDate: employee.contract.contractEndDate
                  ? employee.contract.contractEndDate.toISOString()
                  : null,
                workLocation: employee.contract.workLocation,
                workSchedule: employee.contract.workSchedule,
              }
            : undefined
        }
      />
    </div>
  );
}
