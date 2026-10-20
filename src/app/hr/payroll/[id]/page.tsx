import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth";
import { periodLabel } from "@/lib/payroll";
import { COMPANY } from "@/lib/company";
import DeleteButton from "@/components/DeleteButton";
import PayrollRunEntries from "@/components/PayrollRunEntries";
import { getAppLanguage, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: { id: string } }) {
  const t = getT();
  await requireAdminPage();

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { entries: { orderBy: { employeeName: "asc" } } },
  });
  if (!run) notFound();

  const label = periodLabel(run.period, getAppLanguage() === "zh" ? "ZH_HANT" : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/hr/payroll" className="text-sm text-ink-muted hover:text-ink flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> {t("All payroll runs")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink">{label}</h1>
          </div>
          <DeleteButton
            url={`/api/payroll/${run.id}`}
            confirmNumber={run.period}
            itemLabel={t("payroll run")}
            redirectTo="/hr/payroll"
          />
        </div>
        <p className="text-sm text-ink-muted mt-1">
          {run.entries.length === 1
            ? t("{count} Employee", { count: run.entries.length })
            : t("{count} Employees", { count: run.entries.length })}
        </p>
      </div>

      <PayrollRunEntries
        runId={run.id}
        entries={run.entries.map((e: any) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
          payslipSentAt: e.payslipSentAt ? e.payslipSentAt.toISOString() : null,
        })) as any}
        periodLabel={label}
        companyName={COMPANY.shortName || COMPANY.name}
      />
    </div>
  );
}
