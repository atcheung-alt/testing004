"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/employees";

export default function RejoinEmployeeForm({
  employeeId,
  employeeName,
  defaults,
  companies,
}: {
  employeeId: string;
  employeeName: string;
  defaults: {
    title: string;
    nickname: string;
    employmentType: string;
    salary: number;
    companyId: string;
  };
  companies: { id: string; name: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [title, setTitle] = useState(defaults.title);
  const [nickname, setNickname] = useState(defaults.nickname);
  const [employmentType, setEmploymentType] = useState(defaults.employmentType);
  const [salary, setSalary] = useState(defaults.salary);
  const [companyId, setCompanyId] = useState(defaults.companyId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate) {
      setError("A new start date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/rejoin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          title,
          nickname,
          employmentType: employmentType || null,
          salary,
          companyId: companyId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the new employment record.");
      router.push(`/hr/employees/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-4 max-w-xl">
      <p className="text-sm text-ink-muted">
        {t(
          "{name}'s previous record stays on file, including payroll, leave, and the old contract. This creates a new employment record you can open beside it.",
          { name: employeeName }
        )}
      </p>
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-500/30 rounded-xl px-3 py-2">{t(error)}</p>
      )}
      <div>
        <label className="label">{t("New start date *")}</label>
        <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </div>
      <div>
        <label className="label">{t("Company")}</label>
        <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">{t("No company")}</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">{t("Nickname")}</label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("e.g. AT")} />
        </div>
        <div>
          <label className="label">{t("Title")}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">{t("Employment type")}</label>
          <select className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
            <option value="">{t("Not set")}</option>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("Salary")}</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t("Saving…") : t("Create rejoin record")}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
