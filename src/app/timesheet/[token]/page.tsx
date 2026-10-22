import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { sheetByToken, summarizeSlots, timesheetBasis } from "@/lib/timesheets";
import TimesheetForm from "@/components/TimesheetForm";
import { COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function TimesheetPage({ params }: { params: { token: string } }) {
  const t = getT();
  const sheet = await sheetByToken(params.token);
  const employee = sheet
    ? await prisma.employee.findUnique({
        where: { id: sheet.employeeId },
        select: { name: true, employmentType: true, payRateType: true },
      })
    : null;
  const basis = employee ? timesheetBasis(employee.employmentType, employee.payRateType) : null;

  if (!sheet || !employee || !basis) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-3">
        <ShieldAlert size={40} className="text-danger-500" />
        <h1 className="font-display text-xl font-semibold text-ink">{t("This Link Isn't Valid")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "It may have been mistyped, or the employee record it points to no longer exists. Please contact {contact} if you believe this is a mistake.",
            { contact: COMPANY.contact?.email || COMPANY.shortName || COMPANY.name }
          )}
        </p>
      </div>
    );
  }

  const summary = summarizeSlots(sheet.slots);
  return (
    <TimesheetForm
      token={params.token}
      initial={{
        employeeName: employee.name,
        period: sheet.period,
        status: sheet.status,
        note: sheet.note,
        slots: sheet.slots,
        basis,
        hours: summary.hours,
        days: summary.days,
      }}
    />
  );
}
