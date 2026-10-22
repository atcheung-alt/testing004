import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { andFilters, employeeScopeFor, employeeScopeWhere } from "@/lib/documentAccess";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/employees";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import HrDocumentFilters from "@/components/HrDocumentFilters";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const TYPES = ["FULL_TIME", "PART_TIME", "FREELANCE"];
const KINDS = ["contract", "payslip", "salary", "ir56b"];

type DocRow = {
  key: string;
  name: string;
  company: string;
  type: string;
  kind: string;
  detail: string;
  href: string;
};

export default async function HrDocumentsPage({
  searchParams,
}: {
  searchParams: { company?: string; type?: string; kind?: string; year?: string };
}) {
  const t = getT();
  const user = await getCurrentUser();
  const scope = await employeeScopeFor(user);
  if (scope.mode === "deny") redirect("/hr/profile");

  const now = new Date().getFullYear();
  const year = /^\d{4}$/.test(searchParams.year || "") ? searchParams.year! : String(now);
  const kind = KINDS.includes(searchParams.kind || "") ? searchParams.kind! : "all";
  const companies = await prisma.employerCompany.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const companyId =
    searchParams.company && companies.some((company) => company.id === searchParams.company)
      ? searchParams.company
      : undefined;

  const employees = await prisma.employee.findMany({
    where: andFilters(
      {
        companyId,
        employmentType: searchParams.type && TYPES.includes(searchParams.type) ? searchParams.type : undefined,
      },
      employeeScopeWhere(scope)
    ),
    select: {
      id: true,
      name: true,
      employmentType: true,
      company: { select: { name: true } },
      contract: { select: { status: true } },
    },
    orderBy: { name: "asc" },
  });
  const ids = employees.map((employee) => employee.id);
  const entries =
    ids.length && (kind === "all" || kind === "payslip")
      ? await prisma.payrollEntry.findMany({
          where: { employeeId: { in: ids }, run: { period: { startsWith: year } } },
          select: {
            id: true,
            runId: true,
            employeeId: true,
            run: { select: { period: true } },
          },
          orderBy: { run: { period: "desc" } },
        })
      : [];

  const rows: DocRow[] = [];
  for (const employee of employees) {
    const company = employee.company?.name || t("No company");
    const type = EMPLOYMENT_TYPE_LABELS[employee.employmentType || ""] || "";
    if ((kind === "all" || kind === "contract") && employee.contract && employee.contract.status !== "CANCELLED") {
      rows.push({
        key: `contract-${employee.id}`,
        name: employee.name,
        company,
        type,
        kind: "Contract",
        detail: t(employee.contract.status),
        href: `/api/employees/${employee.id}/contract/pdf`,
      });
    }
    if (kind === "all" || kind === "salary") {
      rows.push({
        key: `salary-${employee.id}`,
        name: employee.name,
        company,
        type,
        kind: "Salary report",
        detail: year,
        href: `/api/employees/${employee.id}/salary-report/pdf?from=${year}-01&to=${year}-12`,
      });
    }
    if (kind === "all" || kind === "ir56b") {
      rows.push({
        key: `ir56b-${employee.id}`,
        name: employee.name,
        company,
        type,
        kind: "IR56B",
        detail: year,
        href: `/api/employees/${employee.id}/ir56b/pdf?year=${year}`,
      });
    }
  }
  for (const entry of entries) {
    const employee = employees.find((item) => item.id === entry.employeeId);
    if (!employee) continue;
    rows.push({
      key: `payslip-${entry.id}`,
      name: employee.name,
      company: employee.company?.name || t("No company"),
      type: EMPLOYMENT_TYPE_LABELS[employee.employmentType || ""] || "",
      kind: "Payslip",
      detail: entry.run.period,
      href: `/api/payroll/${entry.runId}/entries/${entry.id}/pdf`,
    });
  }

  const years = [String(now), String(now - 1), String(now - 2)];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Documents")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Contracts, payslips, salary reports, and IR56B forms. Filter by company and employment type, then download.")}
        </p>
      </div>
      <HrDocumentFilters companies={scope.mode === "self" ? [] : companies} years={years} />
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">{t("No documents match these filters.")}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3">{t("Name")}</th>
                <th className="px-5 py-3">{t("Company")}</th>
                <th className="px-5 py-3">{t("Employment type")}</th>
                <th className="px-5 py-3">{t("Document")}</th>
                <th className="px-5 py-3">{t("Detail")}</th>
                <th className="px-5 py-3 text-right">{t("Download PDF")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{row.name}</td>
                  <td className="px-5 py-3 text-ink-muted">{row.company}</td>
                  <td className="px-5 py-3 text-ink-muted">{row.type ? t(row.type) : "—"}</td>
                  <td className="px-5 py-3">{t(row.kind)}</td>
                  <td className="px-5 py-3 text-ink-muted">{row.detail}</td>
                  <td className="px-5 py-3 text-right">
                    <DownloadPdfButton url={row.href} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
