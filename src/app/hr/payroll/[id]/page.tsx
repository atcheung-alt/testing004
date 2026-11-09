import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth";
import { periodLabel } from "@/lib/payroll";
import { getEmployeeDisplayName } from "@/lib/employeeName";
import { isInternalCompanyName } from "@/lib/employerCompany";
import { COMPANY } from "@/lib/company";
import DeleteButton from "@/components/DeleteButton";
import FinishPayrollButton from "@/components/FinishPayrollButton";
import { PayrollRunSearch, PayrollRunSearchBox, PayrollRunTables } from "@/components/PayrollRunSearch";
import { getAppLanguage, getT } from "@/lib/i18n/server";
import { readStaffDirectory } from "@/lib/staffDirectory";
import { normalizeEmail } from "@/lib/accessControl";
import { findClientBill, readClientTerms, serviceFeeFor, termFor } from "@/lib/clientService";
import { formatCurrency } from "@/lib/calculations";
import ClientInvoiceButton from "@/components/ClientInvoiceButton";
import PayrollCompanyFilter from "@/components/PayrollCompanyFilter";
import PayrollMonthEditor from "@/components/PayrollMonthEditor";
export const dynamic = "force-dynamic";

export default async function PayrollRunPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { company?: string };
}) {
  const t = getT();
  await requireAdminPage();

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        orderBy: { employeeName: "asc" },
        include: {
          employee: {
            select: {
              companyId: true,
              preferredName: true,
              nickname: true,
              nameChinese: true,
              startDate: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!run) notFound();

  const label = periodLabel(run.period, getAppLanguage() === "zh" ? "ZH_HANT" : undefined);
  const directory = await readStaffDirectory();
  const terms = await readClientTerms();
  const bills = await Promise.all(
    Array.from(new Set(run.entries.map((entry) => entry.employee.companyId).filter((id): id is string => !!id))).map(
      async (companyId) => ({ companyId, bill: await findClientBill(run.id, companyId) })
    )
  );
  const invoiceByCompany = new Map(bills.map((item) => [item.companyId, item.bill?.invoiceId || null]));
  const clientGroups = new Map<
    string,
    { companyId: string; name: string; headcount: number; gross: number; employerMpf: number; net: number }
  >();
  for (const entry of run.entries) {
    const companyId = entry.employee.companyId;
    if (!companyId || !entry.employee.company || isInternalCompanyName(entry.employee.company.name)) continue;
    const current = clientGroups.get(companyId) || {
      companyId,
      name: entry.employee.company.name,
      headcount: 0,
      gross: 0,
      employerMpf: 0,
      net: 0,
    };
    current.headcount += 1;
    current.gross += entry.grossPay;
    current.employerMpf += entry.employerMpf;
    current.net += entry.netPay;
    clientGroups.set(companyId, current);
  }
  const clientBills = Array.from(clientGroups.values())
    .map((group) => {
      const term = termFor(terms, group.companyId);
      const serviceFee = serviceFeeFor(term, group.headcount, group.gross);
      return {
        ...group,
        serviceFee,
        billTotal: group.gross + group.employerMpf + serviceFee,
        invoiceId: invoiceByCompany.get(group.companyId) || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const companies = clientBills.map((bill) => ({ id: bill.companyId, name: bill.name }));
  const selected = companies.find((company) => company.id === searchParams.company) || null;
  const shownBills = selected ? clientBills.filter((bill) => bill.companyId === selected.id) : clientBills;
  const companyEntries = selected
    ? run.entries.filter((entry) => entry.employee.companyId === selected.id)
    : run.entries;
  const unpaid = companyEntries.filter((entry) => !entry.paidAt);
  const visibleEntries = companyEntries;
  const exportParams = new URLSearchParams();
  if (selected) exportParams.set("company", selected.id);
  const exportHref = `/api/payroll/${run.id}/export${exportParams.toString() ? `?${exportParams}` : ""}`;
  const categoryByEmail = new Map(
    directory.profiles.map((profile) => [normalizeEmail(profile.email), profile.category])
  );
  const serialized = visibleEntries.map((entry) => ({
    ...entry,
    preferredName: entry.employee.preferredName,
    nickname: entry.employee.nickname,
    nameChinese: entry.employee.nameChinese,
    startDate: entry.employee.startDate ? entry.employee.startDate.toISOString() : null,
    employerName:
      entry.employee.company && !isInternalCompanyName(entry.employee.company.name)
        ? entry.employee.company.name
        : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    payslipSentAt: entry.payslipSentAt ? entry.payslipSentAt.toISOString() : null,
    paidAt: entry.paidAt ? entry.paidAt.toISOString() : null,
  }));
  const sections = [
    {
      key: "HR_PLUS_STAFF",
      title: "HR Plus staff payroll",
      note: "Monthly salary with MPF, for accounts marked HR Plus staff.",
    },
    {
      key: "FULL_TIME",
      title: "Full-time payroll",
      note: "Monthly salary with MPF.",
    },
    {
      key: "PART_TIME",
      title: "Part-time payroll",
      note: "Daily or hourly pay.",
    },
    {
      key: "FREELANCE",
      title: "Freelance payroll",
      note: "Project fee, without MPF.",
    },
  ] as const;
  function bucket(entry: { employeeEmail: string | null; employmentType: string | null }) {
    const email = entry.employeeEmail ? normalizeEmail(entry.employeeEmail) : "";
    const category = email ? categoryByEmail.get(email) : undefined;
    if (
      category === "HR_PLUS_STAFF" ||
      category === "FULL_TIME" ||
      category === "PART_TIME" ||
      category === "FREELANCE"
    ) {
      return category;
    }
    if (entry.employmentType === "PART_TIME") return "PART_TIME";
    if (entry.employmentType === "FREELANCE") return "FREELANCE";
    return "FULL_TIME";
  }

  const grouped = serialized.map((entry) => ({ ...entry, group: bucket(entry) }));
  const staff = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      title: true,
      preferredName: true,
      nickname: true,
      nameChinese: true,
    },
    orderBy: { name: "asc" },
  });
  const onRun = new Set(run.entries.map((entry) => entry.employeeId));
  const monthPeople = [
    ...run.entries.map((entry) => ({
      employeeId: entry.employeeId,
      entryId: entry.id,
      name: getEmployeeDisplayName({
        name: entry.employeeName,
        preferredName: entry.employee.preferredName,
        nickname: entry.employee.nickname,
        nameChinese: entry.employee.nameChinese,
      }),
      note: t("On this payroll"),
    })),
    ...staff
      .filter((employee) => !onRun.has(employee.id))
      .map((employee) => ({
        employeeId: employee.id,
        entryId: null,
        name: getEmployeeDisplayName(employee),
        note: employee.title ? `${t("Not on this payroll")} · ${employee.title}` : t("Not on this payroll"),
      })),
  ];

  return (
    <PayrollRunSearch>
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/hr/payroll" className="text-sm text-ink-muted hover:text-ink flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> {t("All payroll runs")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink">{label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <PayrollMonthEditor
              runId={run.id}
              periodLabel={label}
              people={monthPeople}
            />
            <DeleteButton
            url={`/api/payroll/${run.id}`}
            confirmNumber={run.period}
            itemLabel={t("payroll run")}
            redirectTo="/hr/payroll"
          />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            {t("{paid} of {total} paid", {
              paid: companyEntries.length - unpaid.length,
              total: companyEntries.length,
            })}
          </p>
          <FinishPayrollButton
            runId={run.id}
            ready={companyEntries.length > 0 && unpaid.length === 0}
            done={run.status === "FINALIZED"}
          />
        </div>
        {companyEntries.length > 0 ? (
          <p
            className={`mt-2 rounded-xl border px-3 py-2 text-sm ${
              unpaid.length === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {unpaid.length === 0
              ? t("Everyone is paid. You can finish this payroll.")
              : t("{count} still to pay. Finish stays off until each person is marked paid.", {
                  count: unpaid.length,
                })}
          </p>
        ) : null}
        <p className="text-sm text-ink-muted mt-1">
          {visibleEntries.length === 1
            ? t("{count} Employee", { count: visibleEntries.length })
            : t("{count} Employees", { count: visibleEntries.length })}
          {selected ? ` · ${selected.name}` : ""}
        </p>
        {companyEntries.length > 0 ? (
          <p className="text-sm text-ink-muted mt-1">
            {unpaid.length === 0 ? (
              t("Everyone is paid.")
            ) : (
              <>
                {t("{count} still to pay", { count: unpaid.length })}
                {": "}
                {unpaid.map((entry, index) => (
                  <span key={entry.id}>
                    {index > 0 ? ", " : ""}
                    <a
                      href={`/hr/payroll/${run.id}${selected ? `?company=${selected.id}` : ""}#payroll-${entry.id}`}
                      className="text-ink hover:text-brand-600"
                    >
                      {getEmployeeDisplayName({
                        name: entry.employeeName,
                        preferredName: entry.employee.preferredName,
                        nickname: entry.employee.nickname,
                        nameChinese: entry.employee.nameChinese,
                      })}
                    </a>
                  </span>
                ))}
              </>
            )}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <PayrollRunSearchBox />
          {companies.length > 0 ? (
            <PayrollCompanyFilter runId={run.id} companies={companies} selected={selected?.id || ""} />
          ) : null}
          <a href={exportHref} className="btn-secondary">
            <Download size={15} /> {t("Export CSV")}
          </a>
        </div>
      </div>

      {shownBills.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t("Bill each client")}</h2>
            <p className="text-sm text-ink-muted">
              {t(
                "Same idea as other payroll-parking services: the client pays the wages, the employer MPF, and your service fee. The worker is still paid the net amount below."
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {shownBills.map((bill) => (
              <div key={bill.companyId} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-ink">{bill.name}</h3>
                    <p className="text-xs text-ink-muted">{t("{count} people", { count: bill.headcount })}</p>
                  </div>
                  <ClientInvoiceButton runId={run.id} companyId={bill.companyId} invoiceId={bill.invoiceId} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-ink-muted">{t("Wages")}</dt>
                  <dd className="text-right font-mono">{formatCurrency(bill.gross)}</dd>
                  <dt className="text-ink-muted">{t("Employer MPF")}</dt>
                  <dd className="text-right font-mono">{formatCurrency(bill.employerMpf)}</dd>
                  <dt className="text-ink-muted">{t("Service fee")}</dt>
                  <dd className="text-right font-mono">{formatCurrency(bill.serviceFee)}</dd>
                  <dt className="font-medium text-ink">{t("Client pays")}</dt>
                  <dd className="text-right font-mono font-medium">{formatCurrency(bill.billTotal)}</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <PayrollRunTables
        entries={grouped as any}
        groups={sections.map((section) => ({ key: section.key, title: t(section.title), note: t(section.note) }))}
        runId={run.id}
        period={run.period}
        periodLabel={label}
        companyName={COMPANY.shortName || COMPANY.name}
      />
    </div>
    </PayrollRunSearch>
  );
}
