"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type CompanyOption = { id: string; name: string; label: string };

export default function RegisterForm({ firstAccount }: { firstAccount: boolean }) {
  const t = useT();
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (firstAccount) return;
    fetch("/api/auth/companies")
      .then((res) => res.json())
      .then((data) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]));
  }, [firstAccount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, companyId }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t("Could not create the account."));
      return;
    }
    router.push(data.status === "PENDING" ? "/pending" : "/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-6 flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold">{firstAccount ? t("Create the top admin") : t("Create an account")}</h1>
        <p className="text-sm text-ink-muted mt-1">
          {firstAccount
            ? t("This first account can confirm every other company and decide what they can open.")
            : t("Choose your company. You can sign in now, and an admin must confirm the account before you can see any records.")}
        </p>
      </div>
      {error && <p className="text-sm text-danger-500">{error}</p>}
      <div>
        <label className="label">{t("Name")}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <label className="label">{t("Email")}</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="label">{t("Password")}</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      {!firstAccount && (
        <div>
          <label className="label">{t("Company")}</label>
          <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">{t("Choose a company")}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.label} — {company.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className="btn-primary justify-center" disabled={saving}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
        {t("Create account")}
      </button>
      <Link href="/login" className="text-sm text-brand-500 hover:text-brand-600">
        {t("Already have an account? Log in")}
      </Link>
    </form>
  );
}
