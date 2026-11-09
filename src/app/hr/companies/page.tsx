import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { employeeScopeFor } from "@/lib/documentAccess";
import EmployerCompaniesManager from "@/components/EmployerCompaniesManager";
import { clientCompanies } from "@/lib/employerCompany";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ClientCompaniesPage() {
  const t = getT();
  const user = await getCurrentUser();
  const scope = await employeeScopeFor(user);
  if (scope.mode !== "all") redirect(scope.mode === "deny" ? "/hr/profile" : "/hr/employees");

  const companies = await prisma.employerCompany.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { employees: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Client companies")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "Add and manage external client companies. Staff without a client company assigned will default to HR Plus internal payroll."
          )}
        </p>
      </div>
      <EmployerCompaniesManager
        companies={clientCompanies(companies).map((company) => ({
            id: company.id,
            name: company.name,
            employeeCount: company._count.employees,
          }))}
      />
    </div>
  );
}
