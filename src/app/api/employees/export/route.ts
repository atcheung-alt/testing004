import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdminApi } from "@/lib/auth";
import { andFilters, employeeScopeFor, employeeScopeWhere } from "@/lib/documentAccess";
import { formatDate } from "@/lib/calculations";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";
import { appLanguageFromRequest } from "@/lib/i18n/downloadLanguage";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "ONBOARDING", "FORMER"];

/**
 * CSV export for the employee list — takes the same `q`/`status` query
 * params as the /hr/employees page so "Export CSV" always reflects
 * whatever search and filter are active there.
 */
export async function GET(request: NextRequest) {
  const scope = await employeeScopeFor(await getCurrentUser());
  if (scope.mode !== "all" && scope.mode !== "company") {
    const denied = await requireAdminApi();
    if (denied) return denied;
  }

  const language = appLanguageFromRequest(request);
  const t = (key: string) => translate(language, key);
  const q = request.nextUrl.searchParams.get("q") || undefined;
  const status = request.nextUrl.searchParams.get("status") || undefined;

  const employees = await prisma.employee.findMany({
    where: andFilters(
      {
        status: status && STATUSES.includes(status) ? status : undefined,
        OR: q
          ? [
              { name: { contains: q, mode: "insensitive" } },
              { preferredName: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
      },
      employeeScopeWhere(scope)
    ),
    orderBy: { name: "asc" },
  });

  const rows = employees.map((e) => [
    e.name,
    e.nameChinese || "",
    e.title || "",
    t(e.status),
    t(e.employmentType || ""),
    e.hkid || "",
    e.phone || "",
    e.companyEmail || e.email || "",
    e.personalEmail || "",
    e.address || "",
    e.startDate ? formatDate(e.startDate) : "",
    e.lastDay ? formatDate(e.lastDay) : "",
    e.bankName || "",
    e.bankAccount || "",
    e.salary != null ? e.salary.toFixed(2) : "",
    e.payRate != null ? e.payRate.toFixed(2) : "",
    e.annualLeaveDays != null ? String(e.annualLeaveDays) : "",
  ]);

  const csv = buildCsv(
    [
      "Name",
      "Chinese Name",
      "Title",
      "Status",
      "Employment Type",
      "HKID",
      "Phone",
      "Email",
      "Personal Email",
      "Address",
      "Start Date",
      "Last Day",
      "Bank Name",
      "Bank Account",
      "Salary",
      "Pay Rate",
      "Annual Leave Days",
    ].map(t),
    rows
  );
  const body = language === "zh" ? `\uFEFF${csv}` : csv;

  return new NextResponse(body, { headers: csvResponseHeaders("employees.csv") });
}
