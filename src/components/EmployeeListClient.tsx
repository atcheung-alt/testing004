"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import Portal from "@/components/Portal";
import SendOnboardingButton from "@/components/SendOnboardingButton";
import { formatDate, formatCurrency } from "@/lib/calculations";
import { EMPLOYMENT_TYPE_LABELS, PAY_RATE_TYPE_LABELS, hasAnnualLeaveEntitlement } from "@/lib/employees";
import { useT } from "@/lib/i18n/client";

// Every field the row-click preview panel below wants to show, pre-serialized
// (dates as ISO strings) and pre-computed (mpfReminder, contractActionLabel)
// server-side in src/app/hr/employees/page.tsx — see that file for why.
export type EmployeeListItem = {
  id: string;
  name: string;
  preferredName: string | null;
  nickname: string | null;
  companyId: string | null;
  nameChinese: string | null;
  title: string;
  status: string;
  employmentType: string | null;
  payRateType: string | null;
  payRate: number;
  salary: number;
  annualLeaveDays: number;
  startDate: string | null;
  lastDay: string | null;
  leavingReason: string | null;
  hkid: string | null;
  address: string | null;
  gender: string | null;
  birthday: string | null;
  nationality: string | null;
  phone: string | null;
  companyEmail: string | null;
  email: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankCardName: string | null;
  bankCode: string | null;
  onboardingSentAt: string | null;
  onboardingCompletedAt: string | null;
  mpfVerifiedAt: string | null;
  pendingLeaveCount: number;
  contractStatus: string | null;
  contractActionLabel: string | null;
  mpfReminder: { severity: "upcoming" | "overdue"; label: string } | null;
};

/** "Full name (Preferred name) Chinese name" — only the parts that exist. */
function displayName(e: EmployeeListItem): string {
  let out = e.name;
  if (e.preferredName) out += ` (${e.preferredName})`;
  if (e.nameChinese) out += ` ${e.nameChinese}`;
  return out;
}

function statusStampClass(status: string): string {
  if (status === "ACTIVE") return "border-brand-500 text-brand-500 bg-brand-50";
  if (status === "ONBOARDING") return "border-cyan-500 text-cyan-600 bg-cyan-50";
  return "border-ink-faint text-ink-faint";
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink text-right">{value || "—"}</span>
    </div>
  );
}

// Split out and memoized so that opening/closing the preview panel — which
// only changes `selectedId` in the parent below — doesn't force React to
// re-run this map over every employee on every click. Without this, clicking
// a row re-renders the entire table (all rows, all badge conditionals) just
// to open a panel that only cares about the ONE selected employee; that
// re-render cost grows with headcount, which is exactly why it got
// noticeably slower to open a preview as more employees were added.
const EmployeeTable = memo(function EmployeeTable({
  employees,
  companies,
  onSelect,
  onCompanyChange,
}: {
  employees: EmployeeListItem[];
  companies: { id: string; name: string }[];
  onSelect: (id: string) => void;
  onCompanyChange: (id: string, companyId: string) => void;
}) {
  const t = useT();
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <th className="px-5 py-3">{t("Name")}</th>
            <th className="hidden md:table-cell px-5 py-3">{t("Title")}</th>
            <th className="hidden lg:table-cell px-5 py-3">{t("Company")}</th>
            <th className="px-5 py-3">{t("Status")}</th>
            <th className="hidden sm:table-cell px-5 py-3">{t("Onboard date")}</th>
            <th className="px-5 py-3 text-right" aria-label={t("Notifications")} />
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr
              key={e.id}
              onClick={() => onSelect(e.id)}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-50/40"
            >
              <td className="px-5 py-3">
                <span className="font-medium text-brand-600 block">
                  {displayName(e)}
                  {e.nickname ? <span className="text-ink-muted font-normal"> · {e.nickname}</span> : null}
                </span>
                {e.employmentType && (
                  <span className="text-xs text-ink-muted block mt-0.5">
                    {t(EMPLOYMENT_TYPE_LABELS[e.employmentType] || e.employmentType)}
                  </span>
                )}
              </td>
              <td className="hidden md:table-cell px-5 py-3 text-ink-muted">
                {e.title || t("No title set")}
              </td>
              <td className="hidden lg:table-cell px-5 py-3" onClick={(event) => event.stopPropagation()}>
                <select
                  className="input py-1 text-sm"
                  value={e.companyId || ""}
                  aria-label={t("Company")}
                  onChange={(event) => onCompanyChange(e.id, event.target.value)}
                >
                  <option value="">{t("No company")}</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3">
                <span className={`stamp justify-center ${statusStampClass(e.status)}`}>{t(e.status)}</span>
              </td>
              <td className="hidden sm:table-cell px-5 py-3 text-ink-muted">
                {e.startDate ? formatDate(e.startDate) : "—"}
              </td>

              {/* Notifications, pushed to the rightmost edge of the row —
                  leave-pending / contract / onboarding / MPF badges only;
                  employment type now shows as its own line under the name
                  instead. */}
              <td className="px-5 py-3">
                <span className="flex items-center gap-2 flex-wrap justify-end">
                  {e.pendingLeaveCount > 0 && (
                    <span className="stamp border-accent-500 text-accent-600 bg-accent-100">
                      {t("{count} Pending", { count: e.pendingLeaveCount })}
                    </span>
                  )}
                  {e.contractActionLabel && (
                    <span className="stamp border-amber-500 text-amber-600 bg-amber-50">
                      {t(e.contractActionLabel)}
                    </span>
                  )}
                  {e.onboardingSentAt && !e.onboardingCompletedAt && (
                    <span className="stamp border-cyan-500 text-cyan-600 bg-cyan-100">
                      {t("Onboarding pending")}
                    </span>
                  )}
                  {e.mpfReminder && (
                    <span
                      className={`stamp ${
                        e.mpfReminder.severity === "overdue"
                          ? "border-danger-500 text-danger-600 bg-danger-50"
                          : "border-amber-500 text-amber-600 bg-amber-50"
                      }`}
                    >
                      {e.mpfReminder.label}
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function NicknameEditor({ employeeId, value }: { employeeId: string; value: string | null }) {
  const t = useT();
  const router = useRouter();
  const [nickname, setNickname] = useState(value || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (nickname.trim() === (value || "")) return;
    setSaving(true);
    try {
      await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{t("Nickname")}</span>
      <input
        className="input py-1 text-sm max-w-[10rem]"
        value={nickname}
        placeholder={t("e.g. AT")}
        disabled={saving}
        onChange={(event) => setNickname(event.target.value)}
        onBlur={save}
      />
    </label>
  );
}

export default function EmployeeListClient({
  employees,
  companies,
}: {
  employees: EmployeeListItem[];
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = employees.find((e) => e.id === selectedId) || null;

  async function changeCompany(id: string, companyId: string) {
    await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyId || null }),
    });
    router.refresh();
  }

  const groups = [
    ...companies.map((company) => ({
      key: company.id,
      title: company.name,
      rows: employees.filter((employee) => employee.companyId === company.id),
    })),
    {
      key: "none",
      title: t("No company"),
      rows: employees.filter(
        (employee) => !employee.companyId || !companies.some((company) => company.id === employee.companyId)
      ),
    },
  ].filter((group) => group.rows.length > 0);

  return (
    <>
      {/* `setSelectedId` is a useState setter, so its identity is stable
          across renders — passing it straight through here keeps
          EmployeeTable's memoization intact. */}
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              {group.title}
              <span className="ml-2 text-sm font-normal text-ink-muted">{group.rows.length}</span>
            </h2>
            <EmployeeTable
              employees={group.rows}
              companies={companies}
              onSelect={setSelectedId}
              onCompanyChange={changeCompany}
            />
          </section>
        ))}
      </div>

      {selected && (
        <Portal>
          {/* No backdrop — this floats on top of the page without blocking
              it, so the employee list underneath stays fully scrollable and
              clickable while the preview is open. Inset from all three free
              edges (top/right/bottom) rather than flush against them, so it
              genuinely reads as a floating card, and rounded on every
              corner since it's no longer docked flush to the viewport edge. */}
          <aside className="fixed top-4 right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)] bg-surface rounded-2xl shadow-2xl border border-line flex flex-col overflow-hidden animate-slide-in-right">
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label={t("Close preview")}
                title={t("Close")}
                className="shrink-0 p-1.5 -m-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper transition-colors"
              >
                <X size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold text-ink truncate">{displayName(selected)}</p>
                <p className="text-sm text-ink-muted truncate mt-0.5">{selected.title || t("No title set")}</p>
                <div className="flex items-center gap-2 flex-wrap mt-2.5">
                  <span className={`stamp ${statusStampClass(selected.status)}`}>{t(selected.status)}</span>
                  {selected.employmentType && (
                    <span className="stamp border-line text-ink-muted">
                      {t(EMPLOYMENT_TYPE_LABELS[selected.employmentType] || selected.employmentType)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/hr/employees/${selected.id}`)}
                aria-label={t("Open full employee page")}
                title={t("Open full employee page")}
                className="shrink-0 p-1.5 -m-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper transition-colors"
              >
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2 text-sm divide-y divide-line">
              <div className="py-4 flex flex-col gap-2.5 first:pt-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Contact")}</h3>
                <Row label={t("Company email")} value={selected.companyEmail} />
                <Row label={t("Contact email")} value={selected.email} />
                <Row label={t("Personal email")} value={selected.personalEmail} />
                <Row label={t("Phone")} value={selected.phone} />
              </div>

              <div className="py-4 flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Personal")}</h3>
                <Row label={t("Gender")} value={selected.gender ? t(selected.gender) : selected.gender} />
                <Row label={t("Date of birth")} value={formatDate(selected.birthday)} />
                <Row label={t("HKID")} value={selected.hkid} />
                <Row label={t("Nationality")} value={selected.nationality} />
                <Row label={t("Address")} value={selected.address} />
              </div>

              <div className="py-4 flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Employment")}</h3>
                <NicknameEditor key={selected.id} employeeId={selected.id} value={selected.nickname} />
                <label className="flex items-center justify-between gap-3">
                  <span className="text-ink-muted">{t("Company")}</span>
                  <select
                    className="input py-1 text-sm max-w-[12rem]"
                    value={selected.companyId || ""}
                    onChange={(event) => changeCompany(selected.id, event.target.value)}
                  >
                    <option value="">{t("No company")}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Row label={t("Start date")} value={formatDate(selected.startDate)} />
                {selected.status === "FORMER" && (
                  <>
                    <Row label={t("Last day")} value={formatDate(selected.lastDay)} />
                    <Row label={t("Reason of leaving")} value={selected.leavingReason} />
                  </>
                )}
                {selected.payRateType ? (
                  <Row
                    label={t(PAY_RATE_TYPE_LABELS[selected.payRateType] || "Pay rate")}
                    value={
                      formatCurrency(selected.payRate) +
                      (selected.payRateType === "HOURLY"
                        ? t(" /hour")
                        : selected.payRateType === "DAILY"
                        ? t(" /day")
                        : "")
                    }
                  />
                ) : (
                  <Row label={t("Salary")} value={formatCurrency(selected.salary)} />
                )}
                {hasAnnualLeaveEntitlement(selected.employmentType) && (
                  <Row
                    label={t("Annual leave entitlement")}
                    value={t("{count} Days", { count: selected.annualLeaveDays })}
                  />
                )}
              </div>

              <div className="py-4 flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Bank")}</h3>
                <Row label={t("Bank name")} value={selected.bankName} />
                <Row label={t("Bank code")} value={selected.bankCode} />
                <Row label={t("Account holder")} value={selected.bankCardName} />
                <Row label={t("Account number")} value={selected.bankAccount} />
              </div>

              <div className="py-4 flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t("Emergency Contact")}
                </h3>
                <Row label={t("Name")} value={selected.emergencyContactName} />
                <Row label={t("Relationship")} value={selected.emergencyContactRelationship} />
                <Row label={t("Phone")} value={selected.emergencyContactPhone} />
              </div>

              <div className="py-4 flex flex-col gap-2.5 last:pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Status")}</h3>
                <Row
                  label={t("Onboarding")}
                  value={
                    selected.onboardingCompletedAt
                      ? t("Complete — {date}", { date: formatDate(selected.onboardingCompletedAt) })
                      : selected.onboardingSentAt
                      ? t("Invite sent — {date}", { date: formatDate(selected.onboardingSentAt) })
                      : t("Not sent yet")
                  }
                />
                {!selected.onboardingCompletedAt && (
                  <SendOnboardingButton employeeId={selected.id} resend={!!selected.onboardingSentAt} />
                )}
                {selected.employmentType === "FULL_TIME" && (
                  <Row
                    label={t("MPF")}
                    value={
                      selected.mpfVerifiedAt
                        ? t("Verified — {date}", { date: formatDate(selected.mpfVerifiedAt) })
                        : selected.mpfReminder
                        ? selected.mpfReminder.label
                        : t("Not yet verified")
                    }
                  />
                )}
                <Row label={t("Contract")} value={selected.contractStatus ? t(selected.contractStatus) : t("Not created yet")} />
                {selected.pendingLeaveCount > 0 && (
                  <Row label={t("Pending leave requests")} value={String(selected.pendingLeaveCount)} />
                )}
              </div>
            </div>
          </aside>
        </Portal>
      )}
    </>
  );
}
