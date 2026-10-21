import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RejoinEmployeeForm from "@/components/RejoinEmployeeForm";
import { canManageEmployee } from "@/lib/documentAccess";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RejoinEmployeePage({ params }: { params: { id: string } }) {
  const t = getT();
  if (!(await canManageEmployee(params.id))) redirect("/hr/profile");

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { laterEmployment: { select: { id: true } } },
  });
  if (!employee) notFound();
  if (employee.status !== "FORMER") redirect(`/hr/employees/${employee.id}`);
  if (employee.laterEmployment) redirect(`/hr/employees/${employee.laterEmployment.id}`);

  const companies = await prisma.employerCompany.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">
          {t("Rejoin {name}", { name: employee.name })}
        </h1>
        <p className="text-sm text-ink-muted">
          {t("The old employment record is kept. The new one starts from the date you enter here.")}
        </p>
      </div>
      <RejoinEmployeeForm
        employeeId={employee.id}
        employeeName={employee.name}
        companies={companies}
        defaults={{
          title: employee.title,
          nickname: employee.nickname || "",
          employmentType: employee.employmentType || "",
          salary: employee.salary,
          companyId: employee.companyId || "",
        }}
      />
    </div>
  );
}
