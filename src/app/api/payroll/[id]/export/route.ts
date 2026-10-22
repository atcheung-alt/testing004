import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";
import { appLanguageFromRequest } from "@/lib/i18n/downloadLanguage";
import { translate } from "@/lib/i18n/translate";
import { PAY_BASIS_LABELS } from "@/lib/payroll";

export const dynamic = "force-dynamic";

/** Name-by-name pay for one payroll run. `company` limits the file to that company. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const language = appLanguageFromRequest(request);
  const t = (key: string) => translate(language, key);
  const companyId = request.nextUrl.searchParams.get("company") || "";

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: {
      entries: {
        orderBy: { employeeName: "asc" },
        include: { employee: { select: { company: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!run) return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });

  const entries = companyId
    ? run.entries.filter((entry) => entry.employee.company?.id === companyId)
    : run.entries;
  const companyName = entries.find((entry) => entry.employee.company?.name)?.employee.company?.name || "";

  const rows = entries.map((entry) => [
    entry.employee.company?.name || "",
    entry.employeeName,
    entry.employeeTitle || "",
    entry.employmentType ? t(entry.employmentType) : "",
    t(PAY_BASIS_LABELS[entry.payBasis] || entry.payBasis),
    entry.rate.toFixed(2),
    String(entry.unitsWorked),
    entry.grossPay.toFixed(2),
    entry.bonus.toFixed(2),
    entry.employeeMpf.toFixed(2),
    entry.employerMpf.toFixed(2),
    entry.netPay.toFixed(2),
  ]);

  const csv = buildCsv(
    [
      "Company",
      "Name",
      "Title",
      "Employment type",
      "Pay basis",
      "Rate",
      "Units worked",
      "Gross pay",
      "Bonus",
      "Employee MPF",
      "Employer MPF",
      "Net pay",
    ].map(t),
    rows
  );
  const body = language === "zh" ? `\uFEFF${csv}` : csv;
  const asciiName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = companyId ? asciiName || companyId.slice(-6) : "all";
  return new NextResponse(body, {
    headers: csvResponseHeaders(`payroll-${run.period}-${slug}.csv`),
  });
}
