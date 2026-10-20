"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import type { Employee } from "@/types";
import { PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE, PAY_RATE_TYPE_LABELS, hasAnnualLeaveEntitlement } from "@/lib/employees";
import CurrencyInput from "@/components/CurrencyInput";
import { useT } from "@/lib/i18n/client";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

type WorkDetailsContract = {
  id: string;
  status: string;
  workLocation: string | null;
  workSchedule: string | null;
} | null;

export default function EmployeeForm({
  employee,
  contract,
}: {
  employee?: Employee;
  /** The employee's contract, narrowed to just what the work-location/hours
   *  section below needs — see the edit page's `select`. Undefined when
   *  creating a brand-new employee (no contract can exist yet); null when
   *  editing one that hasn't had a contract created yet. Either way, the
   *  section stays hidden — and once the contract is past DRAFT, it's shown
   *  read-only instead, since editing it here would silently drift from the
   *  actual signed letter text (use the full contract page for that). */
  contract?: WorkDetailsContract;
}) {
  const router = useRouter();
  const t = useT();
  // `name`/`nameChinese` are auto-derived server-side from these split
  // fields (see deriveFullName/deriveFullNameChinese in
  // src/lib/employees.ts) — the form only ever collects/submits the split
  // versions. Surname/given name split out specifically so official
  // documents like the IR56B tax form (separate Surname/Given Name boxes)
  // can be filled correctly without guessing how to split a free-text name.
  const [surnameEn, setSurnameEn] = useState(employee?.surnameEn || "");
  const [givenNameEn, setGivenNameEn] = useState(employee?.givenNameEn || "");
  // What they actually go by day to day — shown on the Employees list
  // instead of the full name when set. Optional; everywhere else (PDFs,
  // emails, IR56B) keeps using the full surname + given name.
  const [preferredName, setPreferredName] = useState(employee?.preferredName || "");
  const [title, setTitle] = useState(employee?.title || "");
  const [salary, setSalary] = useState(employee?.salary ?? 0);
  const [payRateType, setPayRateType] = useState(employee?.payRateType || "");
  const [payRate, setPayRate] = useState(employee?.payRate ?? 0);
  const [annualLeaveDays, setAnnualLeaveDays] = useState(employee?.annualLeaveDays ?? 0);
  const [startDate, setStartDate] = useState(toDateInput(employee?.startDate));
  const [hkid, setHkid] = useState(employee?.hkid || "");
  const [address, setAddress] = useState(employee?.address || "");
  const [gender, setGender] = useState(employee?.gender || "");
  const [birthday, setBirthday] = useState(toDateInput(employee?.birthday));
  const [bankName, setBankName] = useState(employee?.bankName || "");
  const [bankAccount, setBankAccount] = useState(employee?.bankAccount || "");
  const [bankCardName, setBankCardName] = useState(employee?.bankCardName || "");
  const [lastDay, setLastDay] = useState(toDateInput(employee?.lastDay));
  const [leavingReason, setLeavingReason] = useState(employee?.leavingReason || "");
  const [status, setStatus] = useState(employee?.status || "ACTIVE");
  const [employmentType, setEmploymentType] = useState(employee?.employmentType || "");
  // Onboarding-related — normally filled in by the employee themselves via
  // the /onboarding/{token} link (see the Employees list "Invite employee"
  // button), kept editable here too so admin can correct anything manually.
  const [email, setEmail] = useState(employee?.email || "");
  // Their work email — matched against a logged-in User's login email to
  // link this record to the /hr/profile self-service tab (see
  // src/lib/myProfile.ts). Kept separate from Contact email above (where
  // the onboarding invite is sent) since those can differ.
  const [companyEmail, setCompanyEmail] = useState(employee?.companyEmail || "");
  const [surnameChinese, setSurnameChinese] = useState(employee?.surnameChinese || "");
  const [givenNameChinese, setGivenNameChinese] = useState(employee?.givenNameChinese || "");
  const [nationality, setNationality] = useState(employee?.nationality || "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [personalEmail, setPersonalEmail] = useState(employee?.personalEmail || "");
  const [emergencyContactName, setEmergencyContactName] = useState(employee?.emergencyContactName || "");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(
    employee?.emergencyContactRelationship || ""
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(employee?.emergencyContactPhone || "");
  const [bankCode, setBankCode] = useState(employee?.bankCode || "");
  // Lives on the EmployeeContract row, not Employee — kept editable here too
  // (in addition to the full contract page) so a quick fix doesn't require
  // navigating away, but only while that contract is still a DRAFT (see the
  // PATCH route's guard) so nothing here can drift from an already-sent or
  // signed letter.
  const [workLocation, setWorkLocation] = useState(contract?.workLocation || "");
  const [workSchedule, setWorkSchedule] = useState(contract?.workSchedule || "");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filling in a last day almost always means the employee has actually
  // left — flip the status automatically rather than making that a second,
  // easy-to-forget manual step. Staff can still override it back either way.
  function handleLastDayChange(value: string) {
    setLastDay(value);
    if (value && status === "ACTIVE") {
      setStatus("FORMER");
    }
  }

  // Full time (or unset) uses the flat Salary field below; Part time/
  // Freelance use a pay rate type + rate instead. Intern is the one type
  // that can go either way — most internships are short enough that a flat
  // monthly stipend makes more sense than tracking hours, but some are still
  // paid hourly — so which field shows for Intern depends on the actual
  // payRateType chosen (see handleInternPayTypeChange below), not just on
  // whether the employment type allows a pay rate at all. Switching into/out
  // of a pay-rate employment type clears whichever field no longer applies,
  // so a stale value never quietly rides along to the wrong pay structure.
  const allowedPayRateTypes = employmentType ? PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE[employmentType] : undefined;
  const isIntern = employmentType === "INTERN";
  const usesPayRate = !!allowedPayRateTypes && (!isIntern || payRateType === "HOURLY");
  // Only Full time accrues annual leave — see hasAnnualLeaveEntitlement in
  // src/lib/employees.ts (Intern/Part time/Freelance are all explicitly not
  // entitled to it).
  const hasNoAnnualLeaveEntitlement = !hasAnnualLeaveEntitlement(employmentType || null);

  function handleEmploymentTypeChange(value: string) {
    setEmploymentType(value);
    const nextAllowed = value ? PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE[value] : undefined;
    if (!nextAllowed) {
      setPayRateType("");
      setPayRate(0);
    } else if (!nextAllowed.includes(payRateType)) {
      setPayRateType("");
    }
    // Zero it out immediately rather than leaving a stale number on screen
    // that the server is just going to drop anyway.
    if (!hasAnnualLeaveEntitlement(value || null)) {
      setAnnualLeaveDays(0);
    }
  }

  // Intern-only: toggle between the two pay structures ("" = flat monthly
  // salary, "HOURLY" = hourly rate). Zeroes out whichever field no longer
  // applies, same reasoning as handleEmploymentTypeChange above.
  function handleInternPayTypeChange(value: string) {
    setPayRateType(value);
    if (value === "HOURLY") {
      setSalary(0);
    } else {
      setPayRate(0);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!surnameEn.trim()) {
      setError(t("Please enter the employee's surname."));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        surnameEn,
        givenNameEn,
        preferredName,
        title,
        salary,
        payRateType: usesPayRate ? payRateType || null : null,
        payRate: usesPayRate ? payRate : 0,
        annualLeaveDays: hasNoAnnualLeaveEntitlement ? 0 : annualLeaveDays,
        startDate: startDate || null,
        hkid,
        address,
        gender,
        birthday: birthday || null,
        bankName,
        bankAccount,
        bankCardName,
        lastDay: lastDay || null,
        leavingReason,
        status,
        employmentType: employmentType || null,
        companyEmail,
        email,
        surnameChinese,
        givenNameChinese,
        nationality,
        phone,
        personalEmail,
        emergencyContactName,
        emergencyContactRelationship,
        emergencyContactPhone,
        bankCode,
      };
      const res = await fetch(employee ? `/api/employees/${employee.id}` : "/api/employees", {
        method: employee ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Something went wrong."));

      if (contract && contract.status === "DRAFT") {
        const contractRes = await fetch(`/api/employees/${data.id}/contract`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updateWorkDetails: true, workLocation, workSchedule }),
        });
        const contractData = await contractRes.json();
        if (!contractRes.ok) {
          throw new Error(contractData.error || t("Employee saved, but the work location/hours couldn't be updated."));
        }
      }

      router.push(`/hr/employees/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Basic Information")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("Surname *")}</label>
            <input
              type="text"
              className="input"
              value={surnameEn}
              onChange={(e) => setSurnameEn(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">{t("Given name")}</label>
            <input
              type="text"
              className="input"
              value={givenNameEn}
              onChange={(e) => setGivenNameEn(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Preferred name")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("What they go by day to day")}
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-faint">{t("Shown on the Employees list instead of the full name, if set.")}</p>
          </div>
          <div>
            <label className="label">{t("Title")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("e.g. Recruitment Consultant")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Status")}</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as "ACTIVE" | "ONBOARDING" | "FORMER")}
            >
              <option value="ACTIVE">{t("Active")}</option>
              {/* Onboarding is only offered here if the employee is already
                  in that state (i.e. they came in through the Invite flow —
                  see /api/employees/invite). Someone whose details are being
                  typed in directly, right here, has by definition already
                  had their information collected, so there's no unfinished
                  onboarding step left for them to be stuck in — and picking
                  this from the dropdown wouldn't generate the token/email an
                  actual onboarding needs anyway. */}
              {employee?.status === "ONBOARDING" && <option value="ONBOARDING">{t("Onboarding")}</option>}
              <option value="FORMER">{t("Former")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Employment type")}</label>
            <select
              className="input"
              value={employmentType}
              onChange={(e) => handleEmploymentTypeChange(e.target.value)}
            >
              <option value="">—</option>
              <option value="FULL_TIME">{t("Full time")}</option>
              <option value="PART_TIME">{t("Part time")}</option>
              <option value="INTERN">{t("Intern")}</option>
              <option value="FREELANCE">{t("Freelance")}</option>
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays size={13} className="text-ink-faint" />
              {t("Start date")}
            </label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Contact email")}</label>
            <input
              type="email"
              className="input"
              placeholder={t("Where the onboarding invite is sent")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Company email")}</label>
            <input
              type="email"
              className="input"
              placeholder={t("Their work email / login address")}
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-faint">{t("Must match their login email — this is what links them to the Profile tab.")}</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Compensation & Leave")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isIntern ? (
            <>
              <div>
                <label className="label">{t("Pay type")}</label>
                <select
                  className="input"
                  value={payRateType === "HOURLY" ? "HOURLY" : ""}
                  onChange={(e) => handleInternPayTypeChange(e.target.value)}
                >
                  <option value="">{t("Monthly salary")}</option>
                  <option value="HOURLY">{t("Hourly rate")}</option>
                </select>
              </div>
              <div>
                <label className="label">{payRateType === "HOURLY" ? t("Hourly rate") : t("Salary (monthly)")}</label>
                <CurrencyInput
                  className="input"
                  value={payRateType === "HOURLY" ? payRate : salary}
                  onChange={(value) => {
                    if (payRateType === "HOURLY") setPayRate(value);
                    else setSalary(value);
                  }}
                />
              </div>
            </>
          ) : usesPayRate ? (
            <>
              <div>
                <label className="label">{t("Pay rate type")}</label>
                <select
                  className="input"
                  value={payRateType}
                  onChange={(e) => setPayRateType(e.target.value)}
                >
                  <option value="">—</option>
                  {(allowedPayRateTypes || []).map((rateType) => (
                    <option key={rateType} value={rateType}>
                      {t(PAY_RATE_TYPE_LABELS[rateType])}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  {payRateType === "PROJECT_FEE"
                    ? t("Fixed project fee")
                    : payRateType === "HOURLY"
                      ? t("Hourly rate")
                      : t("Daily rate")}
                </label>
                <CurrencyInput className="input" value={payRate} onChange={setPayRate} />
              </div>
            </>
          ) : (
            <div>
              <label className="label">{t("Salary (monthly)")}</label>
              <CurrencyInput className="input" value={salary} onChange={setSalary} />
            </div>
          )}
          {hasNoAnnualLeaveEntitlement ? (
            <div>
              <label className="label">{t("Annual leave (days/year)")}</label>
              <p className="input flex items-center text-ink-faint bg-paper">
                {employmentType === "INTERN"
                  ? t("Not entitled — interns don't accrue annual leave")
                  : employmentType === "PART_TIME"
                    ? t("Not entitled — part-time staff don't accrue annual leave")
                    : t("Not entitled — freelancers don't accrue annual leave")}
              </p>
            </div>
          ) : (
            <div>
              <label className="label">{t("Annual leave (days/year)")}</label>
              <input
                type="number"
                step="any"
                min={0}
                className="input"
                value={annualLeaveDays}
                onChange={(e) => setAnnualLeaveDays(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>
      </div>

      {contract && employmentType !== "FREELANCE" && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold mb-4">{t("Work Location & Hours")}</h2>
          {contract.status === "DRAFT" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t("Work location")}</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t("e.g. Hong Kong office")}
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="label">{t("Working hours / schedule")}</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t("e.g. Mon–Fri, 9:30am–6:30pm")}
                  value={workSchedule}
                  onChange={(e) => setWorkSchedule(e.target.value)}
                />
              </div>
              <p className="sm:col-span-2 text-xs text-ink-faint">{t("Also feeds the contract letter — since it's still a draft, this stays in sync.")}</p>
            </div>
          ) : (
            <div className="text-sm text-ink-muted">
              <p>{contract.workLocation || "—"} · {contract.workSchedule || "—"}</p>
              <p className="text-xs text-ink-faint mt-1">{t("The contract has been sent, so these are locked here — go to the contract page to change them.")}</p>
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Personal Information")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("Chinese surname")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("If applicable")}
              value={surnameChinese}
              onChange={(e) => setSurnameChinese(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Chinese given name")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("If applicable")}
              value={givenNameChinese}
              onChange={(e) => setGivenNameChinese(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("HKID")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("e.g. A123456(7)")}
              value={hkid}
              onChange={(e) => setHkid(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Gender")}</label>
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">—</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {t(g)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays size={13} className="text-ink-faint" />
              {t("Birthday")}
            </label>
            <input
              type="date"
              className="input"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Nationality")}</label>
            <input
              type="text"
              className="input"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Phone number")}</label>
            <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("Personal email")}</label>
            <input
              type="email"
              className="input"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("Address")}</label>
            <textarea
              className="input min-h-[70px]"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Emergency Contact")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("Contact name")}</label>
            <input
              type="text"
              className="input"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Relationship")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("e.g. Spouse, Parent")}
              value={emergencyContactRelationship}
              onChange={(e) => setEmergencyContactRelationship(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Contact number")}</label>
            <input
              type="tel"
              className="input"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Bank Details")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("Name of the bank")}</label>
            <input
              type="text"
              className="input"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Bank code")}</label>
            <input
              type="text"
              className="input"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Account number")}</label>
            <input
              type="text"
              className="input"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Account holder")}</label>
            <input
              type="text"
              className="input"
              value={bankCardName}
              onChange={(e) => setBankCardName(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Leaving Details")}</h2>
        <p className="text-xs text-ink-faint mb-3">{t("Only fill these in once the employee has actually left — setting a last day automatically marks them as Former above.")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays size={13} className="text-ink-faint" />
              {t("Last day")}
            </label>
            <input
              type="date"
              className="input"
              value={lastDay}
              onChange={(e) => handleLastDayChange(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Reason of leaving")}</label>
            <input
              type="text"
              className="input"
              value={leavingReason}
              onChange={(e) => setLeavingReason(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t("Saving…") : employee ? t("Save changes") : t("Create employee")}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
