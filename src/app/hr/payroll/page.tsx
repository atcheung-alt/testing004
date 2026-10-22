import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { periodLabel } from "@/lib/payroll";
import { submittedTimesheets, summarizeSlots } from "@/lib/timesheets";
import NewPayrollRunButton from "@/components/NewPayrollRunButton";
import PayrollTimesheetQueue from "@/components/PayrollTimesheetQueue";
import ClickableTableRow from "@/components/ClickableTableRow";
import { getAppLanguage, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PayrollListPage() {
  const t = getT();
  const periodLanguage = getAppLanguage() === "zh" ? "ZH_HANT" : undefined;
  await requireAdminPage();

  const runs = await prisma.payrollRun.findMany({
    orderBy: { period: "desc" },
    include: { entries: { select: { grossPay: true, netPay: true } } },
  });
  const waiting = await submittedTimesheets();
  const names = waiting.length
    ? await prisma.employee.findMany({
        where: { id: { in: waiting.map((sheet) => sheet.employeeId) } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(names.map((employee) => [employee.id, employee.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Payroll")}</h1>
          <p className="text-sm text-ink-muted">
            {t(
              "One run per calendar month. Full-time, part-time, and freelance are paid differently. Each client company is billed for wages, employer MPF, and your service fee."
            )}
          </p>
        </div>
        <NewPayrollRunButton />
      </div>

      <PayrollTimesheetQueue
        items={waiting.map((sheet) => {
          const summary = summarizeSlots(sheet.slots);
          return {
            employeeId: sheet.employeeId,
            employeeName: nameById.get(sheet.employeeId) || sheet.employeeId,
            period: sheet.period,
            hours: summary.hours,
            days: summary.days,
          };
        })}
      />

      {runs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">
          {t("No payroll runs yet — create one for the current month to get started.")}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3">{t("Period")}</th>
                <th className="px-5 py-3">{t("Employees")}</th>
                <th className="px-5 py-3">{t("Gross total")}</th>
                <th className="px-5 py-3">{t("Net total")}</th>
                <th className="px-5 py-3">{t("Created")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run: any) => {
                const totalGross = run.entries.reduce((sum: number, e: any) => sum + e.grossPay, 0);
                const totalNet = run.entries.reduce((sum: number, e: any) => sum + e.netPay, 0);
                return (
                  <ClickableTableRow
                    key={run.id}
                    href={`/hr/payroll/${run.id}`}
                    className="border-b border-line last:border-0 hover:bg-brand-50/40"
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-brand-600">{periodLabel(run.period, periodLanguage)}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{run.entries.length}</td>
                    <td className="px-5 py-3 font-mono">{formatCurrency(totalGross)}</td>
                    <td className="px-5 py-3 font-mono">{formatCurrency(totalNet)}</td>
                    <td className="px-5 py-3 text-ink-muted">{formatDate(run.createdAt)}</td>
                  </ClickableTableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
