import EmployeeForm from "@/components/EmployeeForm";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const t = getT();
  // The form covers every field, including HKID/bank/salary — admin-only,
  // same as viewing or editing an existing record.
  await requireAdminPage();
  const companies = await prisma.employerCompany.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("New Employee")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "Add a new employee record. Once saved, they get a personal link to view their leave balance and submit leave requests."
          )}
        </p>
        <p className="text-sm text-ink-muted mt-1">
          {t(
            "For a worker parked at another company, enter their name, contact email, company, and whether they are full time or part time. Full time needs a monthly salary. Part time needs a daily or hourly rate. A freelance fixed job needs a project fee. HKID, address, and bank details can wait for the onboarding link."
          )}
        </p>
      </div>
      <EmployeeForm companies={companies} />
    </div>
  );
}
