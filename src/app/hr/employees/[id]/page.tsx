import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Clock, FileText, FileDown, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/calculations";
import { ensureLeaveToken, leaveUrlFromHeaders, ensureEmployeeContractSigningToken, employeeContractSigningUrlFromHeaders } from "@/lib/signing";
import {
  computeLeaveBalance,
  EMPLOYEE_STAFF_SELECT,
  EMPLOYMENT_TYPE_LABELS,
  PAY_RATE_TYPE_LABELS,
  getContractPrerequisiteIssues,
  getManualOnboardingCompletionIssues,
  hasAnnualLeaveEntitlement,
} from "@/lib/employees";
import { isValidEmail } from "@/lib/settings";
import { getActivityTimeline } from "@/lib/activity";
import { mpfReminderFor } from "@/lib/payroll";
import { getCurrentUser } from "@/lib/auth";
import { employeeScopeFor, employeeVisibleById } from "@/lib/documentAccess";
import DeleteButton from "@/components/DeleteButton";
import CopySigningLinkButton from "@/components/CopySigningLinkButton";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import SendEmailButton from "@/components/SendEmailButton";
import VerifyContractButton from "@/components/VerifyContractButton";
import ActivityTimeline from "@/components/ActivityTimeline";
import LeaveRequestActions from "@/components/LeaveRequestActions";
import SendOnboardingButton from "@/components/SendOnboardingButton";
import MarkOnboardingCompleteButton from "@/components/MarkOnboardingCompleteButton";
import MpfVerifyButton from "@/components/MpfVerifyButton";
import SalaryReportButton from "@/components/SalaryReportButton";
import IR56BButton from "@/components/IR56BButton";
import { loadEmploymentHistory } from "@/lib/employmentHistory";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink text-right">{value || "—"}</span>
    </div>
  );
}

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const t = getT();
  // Admin-only, like the rest of /hr/employees — non-admins are redirected
  // to /hr/profile (see requireAdminPage). The isAdmin-narrowed
  // EMPLOYEE_STAFF_SELECT branch below is dead code past this guard, but
  // left in place rather than ripped out — a cheap safety net if this page
  // is ever reopened to non-admins again.
  const user = await getCurrentUser();
  const scope = await employeeScopeFor(user);
  if (scope.mode === "deny") redirect("/hr/profile");
  if (!(await employeeVisibleById(params.id))) notFound();
  const isAdmin = scope.mode === "company" || (!!user?.isAdmin && scope.mode === "all");

  // Two different Prisma queries, not one query with fields hidden in the
  // JSX: a non-admin's request never selects HKID/address/birthday/salary/
  // bank columns in the first place, so that data never enters server
  // memory for this request at all rather than merely being un-rendered.
  const employee = isAdmin
    ? await prisma.employee.findUnique({
        where: { id: params.id },
        include: {
          leaveRequests: { orderBy: { createdAt: "desc" } },
          contract: true,
          company: { select: { name: true } },
        },
      })
    : ((await prisma.employee.findUnique({
        where: { id: params.id },
        select: { ...EMPLOYEE_STAFF_SELECT, leaveRequests: { orderBy: { createdAt: "desc" } } },
      })) as any); // deliberately narrower shape for non-admins — see EMPLOYEE_STAFF_SELECT
  if (!employee) notFound();

  const token = await ensureLeaveToken(employee.id);
  const leaveUrl = token ? leaveUrlFromHeaders(token) : null;
  const { entitlement, used, remaining } = computeLeaveBalance(
    employee.annualLeaveDays,
    employee.startDate,
    employee.leaveRequests
  );
  const timeline = await getActivityTimeline("employee", employee.id);
  const history = await loadEmploymentHistory(employee.id);
  const currentIndex = history.findIndex((entry) => entry.id === employee.id);
  const hasLaterRecord = currentIndex >= 0 && currentIndex < history.length - 1;

  const contract = isAdmin ? (employee as any).contract : null;
  let contractSigningUrl: string | null = null;
  if (isAdmin && contract && (contract.status === "SENT" || contract.status === "DRAFT")) {
    const contractToken = await ensureEmployeeContractSigningToken(contract.id);
    contractSigningUrl = contractToken ? employeeContractSigningUrlFromHeaders(contractToken) : null;
  }
  const contractEmail = employee.personalEmail || employee.email || "";
  // Only relevant for an employee who was added directly and never sent an
  // invite link — see MarkOnboardingCompleteButton/the onboarding/complete
  // route for why this is scoped that way.
  const manualCompletionIssues =
    isAdmin && !employee.onboardingSentAt && !employee.onboardingCompletedAt
      ? getManualOnboardingCompletionIssues(employee)
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{employee.name}</h1>
            <span
              className={`stamp ${
                employee.status === "ACTIVE"
                  ? "border-brand-500 text-brand-500 bg-brand-50"
                  : employee.status === "ONBOARDING"
                  ? "border-cyan-500 text-cyan-600 bg-cyan-50"
                  : "border-ink-faint text-ink-faint"
              }`}
            >
              {t(employee.status)}
            </span>
          </div>
          {employee.title && <p className="text-sm text-ink-muted">{employee.title}</p>}
          {(employee.nickname || employee.company?.name) && (
            <p className="text-sm text-ink-muted">
              {[employee.nickname, employee.company?.name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {leaveUrl && (
            <CopySigningLinkButton
              url={leaveUrl}
              label={t("Copy leave link")}
              title={t("Copy this employee's personal leave link")}
            />
          )}
          {isAdmin && (
            <>
              <SalaryReportButton employeeId={employee.id} />
              <IR56BButton employeeId={employee.id} hkid={employee.hkid} address={employee.address} />
              {employee.status === "FORMER" && !hasLaterRecord && (
                <Link href={`/hr/employees/${employee.id}/rejoin`} className="btn-primary">
                  {t("Rejoin")}
                </Link>
              )}
              <Link href={`/hr/employees/${employee.id}/edit`} className="btn-secondary">
                <Pencil size={15} /> {t("Edit")}
              </Link>
              <DeleteButton
                url={`/api/employees/${employee.id}`}
                confirmNumber={employee.name}
                itemLabel={t("employee record")}
                redirectTo="/hr/employees"
              />
            </>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
          {t("Employment history")}
        </h2>
        <p className="text-sm text-ink-muted mb-3">
          {t("Previous and current employment records stay on file. Open any row to see that period.")}
        </p>
        <div className="flex flex-col divide-y divide-line">
          {history.map((entry) => (
            <Link
              key={entry.id}
              href={`/hr/employees/${entry.id}`}
              className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${
                entry.id === employee.id ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span>
                <span className="font-medium">{entry.nickname || entry.name}</span>
                {entry.title ? ` · ${entry.title}` : ""}
                {entry.companyName ? ` · ${entry.companyName}` : ""}
                {entry.id === employee.id ? ` · ${t("This record")}` : ""}
              </span>
              <span className="text-xs">
                {entry.startDate ? formatDate(entry.startDate) : t("No start date")}
                {" – "}
                {entry.lastDay ? formatDate(entry.lastDay) : entry.status === "FORMER" ? t("Left") : t("Present")}
                {" · "}
                {t(entry.status)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Once onboarding is complete (whichever way it got there), this card
          has nothing left to prompt — hide it rather than leave a permanent
          "Onboarding complete" banner taking up space. */}
      {isAdmin && !employee.onboardingCompletedAt && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-cyan-100 text-cyan-600">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                {employee.onboardingSentAt
                  ? t("Onboarding invite sent — {date}", { date: formatDate(employee.onboardingSentAt) })
                  : t("Onboarding not sent yet")}
              </p>
              <p className="text-xs text-ink-muted">
                {employee.email
                  ? t("Contact email: {email}", { email: employee.email })
                  : t("No contact email on file yet.")}
              </p>
              {/* Only shown for a manually-added employee (never invited) —
                  tells the admin what's still missing before they can mark
                  onboarding complete without going through the invite link. */}
              {!employee.onboardingSentAt && manualCompletionIssues.length > 0 && (
                <p className="text-xs text-ink-faint mt-1 max-w-sm">
                  {t("Or fill in the following to mark onboarding complete manually:")}{" "}
                  {manualCompletionIssues.map((issue) => t(issue)).join(t(", "))}
                  {t(".")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SendOnboardingButton employeeId={employee.id} resend={!!employee.onboardingSentAt} />
            {!employee.onboardingSentAt && manualCompletionIssues.length === 0 && (
              <MarkOnboardingCompleteButton employeeId={employee.id} />
            )}
          </div>
        </div>
      )}

      {/* Only Full time employees get an MPF enrollment deadline reminder —
          see mpfReminderFor in src/lib/payroll.ts for why. */}
      {isAdmin && employee.employmentType === "FULL_TIME" && (() => {
        const reminder = mpfReminderFor(employee.employmentType, employee.startDate, employee.mpfVerifiedAt);
        return (
          <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  employee.mpfVerifiedAt
                    ? "bg-emerald-50 text-emerald-600"
                    : reminder?.severity === "overdue"
                    ? "bg-danger-50 text-danger-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {employee.mpfVerifiedAt ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">
                  {employee.mpfVerifiedAt
                    ? t("MPF enrollment verified — {date}", { date: formatDate(employee.mpfVerifiedAt) })
                    : reminder
                    ? t("MPF enrollment needed — deadline {date}", { date: formatDate(reminder.deadline) })
                    : t("MPF enrollment not yet verified")}
                </p>
                <p className="text-xs text-ink-muted">
                  {employee.mpfVerifiedAt
                    ? t("Confirmed enrolled with an MPF trustee.")
                    : employee.startDate
                    ? t("Enrollment window is 60 days from the start date above.")
                    : t("No start date on file yet — add one to track the deadline.")}
                </p>
              </div>
            </div>
            {!employee.mpfVerifiedAt && <MpfVerifyButton employeeId={employee.id} />}
          </div>
        );
      })()}

      {/* Only Full time employees accrue annual leave — see
          hasAnnualLeaveEntitlement in src/lib/employees.ts, the same rule
          EmployeeForm.tsx uses to hide the field on the edit page. Interns/
          Part time/Freelance never accrue any, so these four boxes would
          just show a permanent 0/0/0/0 for them — hidden entirely instead. */}
      {hasAnnualLeaveEntitlement(employee.employmentType) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
              {t("Annual entitlement")}
            </p>
            <p className="font-mono text-xl font-semibold text-ink">
              {t("{count} Days", { count: employee.annualLeaveDays })}
            </p>
            <p className="text-xs text-ink-faint mt-0.5">{t("Full amount per year")}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
              {t("Accrued to date")}
            </p>
            <p className="font-mono text-xl font-semibold text-ink">{t("{count} Days", { count: entitlement })}</p>
            <p className="text-xs text-ink-faint mt-0.5">
              {employee.startDate
                ? t("Based on time worked")
                : t("No start date on file — using full amount")}
            </p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Applied")}</p>
            <p className="font-mono text-xl font-semibold text-ink">{t("{count} Days", { count: used })}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Remaining")}</p>
            <p
              className={`font-mono text-xl font-semibold ${remaining < 0 ? "text-danger-500" : "text-brand-600"}`}
            >
              {t("{count} Days", { count: remaining })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Non-sensitive — visible to every signed-in staff account. */}
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold mb-3">{t("Employment")}</h2>
          <div className="flex flex-col gap-2 text-sm">
            <Row label={t("Gender")} value={employee.gender} />
            <Row
              label={t("Employment type")}
              value={
                EMPLOYMENT_TYPE_LABELS[employee.employmentType || ""]
                  ? t(EMPLOYMENT_TYPE_LABELS[employee.employmentType || ""])
                  : null
              }
            />
            <Row label={t("Company email")} value={employee.companyEmail} />
            <Row label={t("Start date")} value={formatDate(employee.startDate)} />
            {employee.employmentType !== "FREELANCE" && (
              <>
                <Row label={t("Work location")} value={contract?.workLocation} />
                <Row label={t("Working hours")} value={contract?.workSchedule} />
              </>
            )}
            {employee.status === "FORMER" && <Row label={t("Last day")} value={formatDate(employee.lastDay)} />}
            {isAdmin && employee.payRateType ? (
              <Row
                label={t(PAY_RATE_TYPE_LABELS[employee.payRateType] || "Pay rate")}
                value={
                  employee.payRateType === "HOURLY"
                    ? t("{amount} /hour", { amount: formatCurrency(employee.payRate) })
                    : employee.payRateType === "DAILY"
                    ? t("{amount} /day", { amount: formatCurrency(employee.payRate) })
                    : formatCurrency(employee.payRate)
                }
              />
            ) : (
              isAdmin && <Row label={t("Salary")} value={formatCurrency(employee.salary)} />
            )}
            {isAdmin && employee.status === "FORMER" && (
              <Row label={t("Reason of leaving")} value={employee.leavingReason} />
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-semibold">{t("Contract")}</h2>
              {contract && (
                <span
                  className={`stamp ${
                    contract.status === "VERIFIED"
                      ? "border-brand-500 text-brand-500 bg-brand-50"
                      : contract.status === "SIGNED"
                      ? "border-amber-500 text-amber-600 bg-amber-50"
                      : "border-ink-faint text-ink-faint"
                  }`}
                >
                  {t(contract.status)}
                </span>
              )}
            </div>

            {!contract && (() => {
              const issues = getContractPrerequisiteIssues(employee);
              return issues.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-ink-muted">
                    {t("Fill in the following before a contract can be created:")}
                  </p>
                  <ul className="text-sm text-amber-600 list-disc pl-5">
                    {issues.map((issue) => (
                      <li key={issue}>{t(issue)}</li>
                    ))}
                  </ul>
                  {issues.some((i) => i !== "Employee hasn't completed onboarding yet") && (
                    <Link href={`/hr/employees/${employee.id}/edit`} className="btn-secondary self-start">
                      <Pencil size={15} /> {t("Edit employee")}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-ink-muted">{t("No contract has been created yet.")}</p>
                  <Link href={`/hr/employees/${employee.id}/contract`} className="btn-secondary self-start">
                    <FileText size={15} /> {t("Create contract")}
                  </Link>
                </div>
              );
            })()}

            {contract && contract.status === "DRAFT" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-muted">{t("Draft — not yet sent to {name}.", { name: employee.name })}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/hr/employees/${employee.id}/contract`} className="btn-secondary">
                    <Pencil size={15} /> {t("Edit")}
                  </Link>
                  <DownloadPdfButton url={`/api/employees/${employee.id}/contract/pdf`} />
                  <SendEmailButton
                    kind="employees"
                    id={employee.id}
                    endpoint={`/api/employees/${employee.id}/contract/email`}
                    defaultTo={contractEmail}
                    defaultSubject={t("Your employment contract")}
                    defaultBody={t(
                      "Hi {name},\n\nPlease review and sign your employment contract using the button below.",
                      { name: employee.name }
                    )}
                    emailValid={isValidEmail(contractEmail)}
                  />
                </div>
              </div>
            )}

            {contract && contract.status === "SENT" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-muted">{t("Sent — waiting for {name} to sign.", { name: employee.name })}</p>
                <div className="flex flex-wrap gap-2">
                  <DownloadPdfButton url={`/api/employees/${employee.id}/contract/pdf`} />
                  {contractSigningUrl && (
                    <CopySigningLinkButton
                      url={contractSigningUrl}
                      label={t("Copy signing link")}
                      title={t("Copy the public review & sign link")}
                    />
                  )}
                  <SendEmailButton
                    kind="employees"
                    id={employee.id}
                    endpoint={`/api/employees/${employee.id}/contract/email`}
                    defaultTo={contractEmail}
                    defaultSubject={t("Your employment contract")}
                    defaultBody={t(
                      "Hi {name},\n\nJust a reminder to review and sign your employment contract using the button below.",
                      { name: employee.name }
                    )}
                    emailValid={isValidEmail(contractEmail)}
                  />
                </div>
              </div>
            )}

            {contract && contract.status === "SIGNED" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-muted">
                  {contract.signedAt
                    ? t("Signed by {name} on {date} — please review before verifying.", {
                        name: contract.signerName || employee.name,
                        date: formatDateTime(contract.signedAt),
                      })
                    : t("Signed by {name} — please review before verifying.", {
                        name: contract.signerName || employee.name,
                      })}
                </p>
                {contract.signedDocumentData ? (
                  <a
                    href={`/api/employees/${employee.id}/contract/signed-document`}
                    className="btn-secondary self-start"
                  >
                    <FileDown size={15} />
                    {t("Download {name}", { name: contract.signedDocumentName || t("signed document") })}
                  </a>
                ) : (
                  contract.signatureData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={contract.signatureData}
                      alt={t("Signature")}
                      className="max-h-20 bg-white rounded-lg border border-line"
                    />
                  )
                )}
                {contract.signedDocumentData && (
                  <p className="text-xs text-ink-faint">{t("Uploaded a scanned/printed document")}</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DownloadPdfButton url={`/api/employees/${employee.id}/contract/pdf`} />
                  <VerifyContractButton employeeId={employee.id} />
                </div>
              </div>
            )}

            {contract && contract.status === "VERIFIED" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-muted">
                  {contract.verifiedAt
                    ? t("Verified on {date} — employee is Active.", { date: formatDateTime(contract.verifiedAt) })
                    : t("Verified — employee is Active.")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <DownloadPdfButton url={`/api/employees/${employee.id}/contract/pdf`} />
                  {contract.driveFileUrl && (
                    <a
                      href={contract.driveFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                    >
                      <ExternalLink size={15} /> {t("Contract on Drive")}
                    </a>
                  )}
                </div>
              </div>
            )}

            {contract && (
              <div className="mt-4 pt-4 border-t border-line">
                <DeleteButton
                  url={`/api/employees/${employee.id}/contract`}
                  confirmNumber={employee.name}
                  itemLabel={t("contract")}
                  redirectTo={`/hr/employees/${employee.id}/contract`}
                  label={t("Delete & regenerate")}
                  extraWarning={
                    contract.status === "DRAFT"
                      ? undefined
                      : contract.status === "SIGNED" || contract.status === "VERIFIED"
                      ? t(
                          "This permanently deletes the {status} contract, including the signature on file, so you can create a new one from scratch.",
                          {
                            status:
                              contract.status === "SIGNED"
                                ? t("signed")
                                : t("verified"),
                          }
                        )
                      : t(
                          "This permanently deletes the {status} contract so you can create a new one from scratch.",
                          {
                            status:
                              contract.status === "SENT"
                                ? t("sent")
                                : contract.status === "CANCELLED"
                                ? t("cancelled")
                                : t(contract.status),
                          }
                        )
                  }
                />
              </div>
            )}
          </div>
        )}

        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold mb-3">{t("Leave Requests")}</h2>
          <LeaveRequestActions
            employeeId={employee.id}
            requests={employee.leaveRequests.map((r: any) => ({
              id: r.id,
              employeeId: employee.id,
              startDate: r.startDate.toISOString(),
              endDate: r.endDate.toISOString(),
              isHalfDay: r.isHalfDay,
              halfDayPeriod: r.halfDayPeriod,
              reason: r.reason,
              status: r.status as "PENDING" | "APPROVED" | "REJECTED",
              decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
              decidedNote: r.decidedNote,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
            }))}
          />
        </div>

        {/* Admin-only — HKID, birthday, address, and bank details never
            reach this point in the JSX (let alone the client) unless
            isAdmin is true; for a non-admin request the underlying Prisma
            query above never even fetched these columns. */}
        {isAdmin && (
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold mb-3">{t("Personal")}</h2>
            <div className="flex flex-col gap-2 text-sm">
              <Row label={t("Chinese name")} value={employee.nameChinese} />
              <Row label={t("HKID")} value={employee.hkid} />
              <Row label={t("Birthday")} value={formatDate(employee.birthday)} />
              <Row label={t("Nationality")} value={employee.nationality} />
              <Row label={t("Phone")} value={employee.phone} />
              <Row label={t("Personal email")} value={employee.personalEmail} />
              <Row label={t("Address")} value={employee.address} />
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold mb-3">{t("Emergency Contact")}</h2>
            <div className="flex flex-col gap-2 text-sm">
              <Row label={t("Name")} value={employee.emergencyContactName} />
              <Row label={t("Relationship")} value={employee.emergencyContactRelationship} />
              <Row label={t("Contact number")} value={employee.emergencyContactPhone} />
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold mb-3">{t("Bank Details")}</h2>
            <div className="flex flex-col gap-2 text-sm">
              <Row label={t("Bank")} value={employee.bankName} />
              <Row label={t("Bank code")} value={employee.bankCode} />
              <Row label={t("Account number")} value={employee.bankAccount} />
              <Row label={t("Account holder")} value={employee.bankCardName} />
            </div>
          </div>
        )}
      </div>

      <ActivityTimeline events={timeline} />
    </div>
  );
}
