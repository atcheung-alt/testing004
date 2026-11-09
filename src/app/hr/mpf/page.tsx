import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeDisplayName } from "@/lib/employeeName";
import { getT } from "@/lib/i18n/server";
import { ensureMpfFormColumns } from "@/lib/mpfForm";
import MpfList from "@/components/MpfList";

export const dynamic = "force-dynamic";

export default async function MpfPage() {
  await requireAdminPage();
  await ensureMpfFormColumns();
  const t = getT();
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      preferredName: true,
      nickname: true,
      nameChinese: true,
      email: true,
      personalEmail: true,
      mpfFormSentAt: true,
      mpfFormDriveUrl: true,
      mpfFormCompletedAt: true,
    },
  });

  const people = employees.map((employee) => ({
    id: employee.id,
    name: getEmployeeDisplayName(employee),
    email: (employee.personalEmail || employee.email || "").trim(),
    status: employee.mpfFormDriveUrl ? "saved" : employee.mpfFormCompletedAt ? "done" : employee.mpfFormSentAt ? "wait" : "not",
    driveUrl: employee.mpfFormDriveUrl,
  })) as {
    id: string;
    name: string;
    email: string;
    status: "not" | "wait" | "saved" | "done";
    driveUrl: string | null;
  }[];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{t("MPF")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Recommended: the employee finishes on eMPF and presses the button in the email. The paper form is still attached, and a signed file is saved in Google Drive as MFP file.")}
      </p>
      <div className="mt-4">
        <MpfList people={people} />
      </div>
    </div>
  );
}
