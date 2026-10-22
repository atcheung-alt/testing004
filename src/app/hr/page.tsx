import Link from "next/link";
import { IdCard, Building2, Clock3, UserPlus, Wallet, CalendarClock, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth";
import { employeeScopeFor } from "@/lib/documentAccess";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Landing page for the HR Management System (/hr) — a lightweight
 *  dashboard rather than an immediate redirect into Employees, so this
 *  reads as its own product with room to grow (Attendance) rather than
 *  just a re-skinned employee list. Admin-only — every non-admin account
 *  is redirected to /hr/profile, the one tab they can see. */
export default async function HrDashboardPage() {
  const t = getT();
  const user = await requireAdminPage();
  const scope = await employeeScopeFor(user);

  const [active, onboarding, former, pendingLeave, pendingOnboarding, draftPayrollRuns] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.count({ where: { status: "ONBOARDING" } }),
    prisma.employee.count({ where: { status: "FORMER" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.employee.count({ where: { onboardingSentAt: { not: null }, onboardingCompletedAt: null } }),
    prisma.payrollRun.count({ where: { status: "DRAFT" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("HR System")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Employee records, onboarding, leave, contracts, and payroll — with attendance on the way.")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Active employees")}</p>
          <p className="font-mono text-2xl font-semibold text-ink">{active}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Onboarding")}</p>
          <p className="font-mono text-2xl font-semibold text-brand-600">{onboarding}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Former")}</p>
          <p className="font-mono text-2xl font-semibold text-ink-faint">{former}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/hr/employees?status=ONBOARDING"
          className="card p-5 flex items-center justify-between gap-3 hover:bg-brand-50/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <UserPlus size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t("Onboarding awaiting completion")}</p>
              <p className="text-xs text-ink-muted">
                {t("{count} invite(s) sent, not yet completed", { count: pendingOnboarding })}
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="text-ink-faint shrink-0" />
        </Link>

        <Link
          href="/hr/employees"
          className="card p-5 flex items-center justify-between gap-3 hover:bg-brand-50/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Clock3 size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t("Pending leave requests")}</p>
              <p className="text-xs text-ink-muted">
                {t("{count} request(s) waiting for a decision", { count: pendingLeave })}
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="text-ink-faint shrink-0" />
        </Link>

        <Link
          href="/hr/payroll"
          className="card p-5 flex items-center justify-between gap-3 hover:bg-brand-50/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t("Payroll runs in draft")}</p>
              <p className="text-xs text-ink-muted">
                {t("{count} run(s) not yet finalized", { count: draftPayrollRuns })}
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="text-ink-faint shrink-0" />
        </Link>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">{t("Modules")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/hr/employees"
            className="rounded-xl border border-line p-4 flex flex-col gap-2 hover:bg-brand-50/60 transition-colors"
          >
            <IdCard size={18} className="text-brand-600" />
            <p className="text-sm font-medium text-ink">{t("Employees")}</p>
            <p className="text-xs text-ink-muted">{t("Records, onboarding, leave & contracts")}</p>
          </Link>
          {scope.mode === "all" && (
            <Link
              href="/hr/companies"
              className="rounded-xl border border-line p-4 flex flex-col gap-2 hover:bg-brand-50/60 transition-colors"
            >
              <Building2 size={18} className="text-brand-600" />
              <p className="text-sm font-medium text-ink">{t("Client companies")}</p>
              <p className="text-xs text-ink-muted">{t("Parked companies and the fee you charge them.")}</p>
            </Link>
          )}
          <Link
            href="/hr/payroll"
            className="rounded-xl border border-line p-4 flex flex-col gap-2 hover:bg-brand-50/60 transition-colors"
          >
            <Wallet size={18} className="text-brand-600" />
            <p className="text-sm font-medium text-ink">{t("Payroll")}</p>
            <p className="text-xs text-ink-muted">{t("Salary runs, MPF, payslips")}</p>
          </Link>
          <div className="rounded-xl border border-dashed border-line p-4 flex flex-col gap-2 text-ink-faint">
            <CalendarClock size={18} />
            <p className="text-sm font-medium flex items-center gap-2">
              {t("Attendance")}
              <span className="text-[9px] font-semibold uppercase tracking-wide border border-line rounded-full px-1.5 py-0.5">
                {t("Soon")}
              </span>
            </p>
            <p className="text-xs">{t("Clock-in/out & timesheets")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
