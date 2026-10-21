import Link from "next/link";
import { Suspense } from "react";
import { Plus, IdCard, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { mpfReminderFor } from "@/lib/payroll";
import { getCurrentUser } from "@/lib/auth";
import { andFilters, employeeScopeFor, employeeScopeWhere } from "@/lib/documentAccess";
import { readClientTerms, termFor } from "@/lib/clientService";
import { redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import SearchBox from "@/components/SearchBox";
import InviteEmployeeButton from "@/components/InviteEmployeeButton";
import EmployeeListClient, { EmployeeListItem } from "@/components/EmployeeListClient";
import EmployerCompaniesManager from "@/components/EmployerCompaniesManager";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "ONBOARDING", "FORMER"];

/** Short badge label for a contract that still needs action — anything
 *  short of VERIFIED, per the employee detail page's own status badge.
 *  Returns null for "no badge needed": a VERIFIED contract, a CANCELLED
 *  one (dead, not actionable), or no contract row at all yet (nothing to
 *  chase — that's what "Create contract" on the detail page is for). */
function contractActionLabel(contract: { status: string } | null): string | null {
  if (!contract) return null;
  if (contract.status === "DRAFT") return "Contract draft";
  if (contract.status === "SENT") return "Contract not signed";
  if (contract.status === "SIGNED") return "Contract unverified";
  return null; // VERIFIED or CANCELLED
}

async function EmployeeList({
  q,
  status,
  isAdmin,
  companies,
  scopeWhere,
}: {
  q?: string;
  status?: string;
  isAdmin: boolean;
  companies: { id: string; name: string }[];
  scopeWhere: Record<string, unknown> | null;
}) {
  const t = getT();
  // This page is admin-only (see requireAdminPage below), so the query pulls
  // every field the row-click preview panel wants to show — no narrower
  // select needed since there's no non-admin viewer of this data to protect
  // it from.
  const employees = await prisma.employee.findMany({
    where: andFilters(
      {
        status: status && STATUSES.includes(status) ? status : undefined,
        OR: q
          ? [
              { name: { contains: q, mode: "insensitive" } },
              { preferredName: { contains: q, mode: "insensitive" } },
              { nickname: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { company: { name: { contains: q, mode: "insensitive" } } },
            ]
          : undefined,
      },
      scopeWhere
    ),
    include: {
      leaveRequests: { where: { status: "PENDING" }, select: { id: true } },
      // Just the status — enough for the badge/preview without pulling the
      // actual contract terms/signature data into this list-view query.
      contract: { select: { status: true } },
    },
    orderBy: { name: "asc" },
  });

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={IdCard}
        title={t("No Employees Found")}
        description={
          isAdmin
            ? t("Try adjusting your filters, or add a new employee record.")
            : t("Try adjusting your filters.")
        }
        // Creating a record is admin-only (see the header button above) —
        // don't offer a path to it here that would just redirect back.
        actionHref={isAdmin ? "/hr/employees/new" : undefined}
        actionLabel={isAdmin ? t("New employee") : undefined}
      />
    );
  }

  // Serialize every Date to an ISO string (client components need plain,
  // serializable props) and precompute the two small helper results
  // (mpfReminder, contractAction) server-side rather than shipping
  // src/lib/payroll.ts's prisma-adjacent module into the client bundle.
  const items: EmployeeListItem[] = employees.map((e) => {
    const rawReminder =
      e.status === "FORMER" ? null : mpfReminderFor(e.employmentType, e.startDate, e.mpfVerifiedAt);
    const mpfReminder = rawReminder
      ? {
          severity: rawReminder.severity,
          label:
            rawReminder.severity === "overdue"
              ? t("MPF overdue ({days}d)", { days: Math.abs(rawReminder.daysRemaining) })
              : rawReminder.daysRemaining === 0
              ? t("MPF due today")
              : t("MPF due in {days}d", { days: rawReminder.daysRemaining }),
        }
      : null;
    const actionLabel = contractActionLabel(e.contract);
    return {
      id: e.id,
      name: e.name,
      preferredName: e.preferredName,
      nickname: e.nickname,
      companyId: e.companyId,
      nameChinese: e.nameChinese,
      title: e.title,
      status: e.status,
      employmentType: e.employmentType,
      payRateType: e.payRateType,
      payRate: e.payRate,
      salary: e.salary,
      annualLeaveDays: e.annualLeaveDays,
      startDate: e.startDate ? e.startDate.toISOString() : null,
      lastDay: e.lastDay ? e.lastDay.toISOString() : null,
      leavingReason: e.leavingReason,
      hkid: e.hkid,
      address: e.address,
      gender: e.gender,
      birthday: e.birthday ? e.birthday.toISOString() : null,
      nationality: e.nationality,
      phone: e.phone,
      companyEmail: e.companyEmail,
      email: e.email,
      personalEmail: e.personalEmail,
      emergencyContactName: e.emergencyContactName,
      emergencyContactRelationship: e.emergencyContactRelationship,
      emergencyContactPhone: e.emergencyContactPhone,
      bankName: e.bankName,
      bankAccount: e.bankAccount,
      bankCardName: e.bankCardName,
      bankCode: e.bankCode,
      onboardingSentAt: e.onboardingSentAt ? e.onboardingSentAt.toISOString() : null,
      onboardingCompletedAt: e.onboardingCompletedAt ? e.onboardingCompletedAt.toISOString() : null,
      mpfVerifiedAt: e.mpfVerifiedAt ? e.mpfVerifiedAt.toISOString() : null,
      pendingLeaveCount: e.leaveRequests.length,
      contractStatus: e.contract?.status || null,
      contractActionLabel: actionLabel ? t(actionLabel) : null,
      mpfReminder,
    };
  });

  return <EmployeeListClient employees={items} companies={companies} />;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const t = getT();
  function statusHref(status?: string) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (status) params.set("status", status);
    return `/hr/employees${params.toString() ? `?${params}` : ""}`;
  }

  // Admin-only — every non-admin account is redirected to /hr/profile, the
  // one tab they can see (see requireAdminPage). `isAdmin` below is always
  // true past this point; EmployeeList still takes it as a prop rather than
  // assuming so, in case that ever changes.
  const user = await getCurrentUser();
  const scope = await employeeScopeFor(user);
  if (scope.mode === "deny") redirect("/hr/profile");
  const [companyRows, terms] = await Promise.all([
    prisma.employerCompany.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { employees: true } } },
    }),
    readClientTerms(),
  ]);
  const companies = companyRows.map((company) => {
    const term = termFor(terms, company.id);
    return {
      id: company.id,
      name: company.name,
      employeeCount: company._count.employees,
      feeMode: term.feeMode,
      feeValue: term.feeValue,
    };
  });
  const isAdmin = scope.mode === "company" || (!!user?.isAdmin && scope.mode === "all");

  const exportParams = new URLSearchParams();
  if (searchParams.q) exportParams.set("q", searchParams.q);
  if (searchParams.status) exportParams.set("status", searchParams.status);
  const exportHref = `/api/employees/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Employees")}</h1>
          <p className="text-sm text-ink-muted">
            {t(
              "Staff records, leave balances, and leave requests submitted through each employee's personal link."
            )}
          </p>
        </div>
        {!!user?.isAdmin && scope.mode === "all" && (
          <div className="flex gap-2 flex-wrap">
            <a href={exportHref} className="btn-secondary shrink-0">
              <Download size={15} /> {t("Export CSV")}
            </a>
            <InviteEmployeeButton />
            <Link href="/hr/employees/new" className="btn-primary shrink-0">
              <Plus size={15} /> {t("New employee")}
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SearchBox placeholder="Search by name or title…" />
        <div className="flex flex-wrap gap-2">
          <Link
            href={statusHref(undefined)}
            className={`stamp ${!searchParams.status ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
          >
            {t("All")}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={statusHref(s)}
              className={`stamp ${searchParams.status === s ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
            >
              {t(s)}
            </Link>
          ))}
        </div>
      </div>

      {scope.mode === "all" && <EmployerCompaniesManager companies={companies} />}

      <Suspense fallback={<div className="text-sm text-ink-muted">{t("Loading…")}</div>}>
        <EmployeeList
          q={searchParams.q}
          status={searchParams.status}
          isAdmin={isAdmin}
          companies={scope.mode === "self" ? [] : companies.map(({ id, name }) => ({ id, name }))}
          scopeWhere={employeeScopeWhere(scope)}
        />
      </Suspense>
    </div>
  );
}
