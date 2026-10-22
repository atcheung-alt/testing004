"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import Portal from "@/components/Portal";
import { useT } from "@/lib/i18n/client";

/** Admin-only quick-add: just name + email, then immediately emails an
 *  onboarding link — see /api/employees/invite. The employee fills in
 *  everything else (HKID, address, emergency contact, bank details)
 *  themselves via that link; this modal intentionally asks for nothing
 *  more than what's needed to create the record and send it. */
function isHrPlus(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "") === "hrplus";
}

export default function InviteEmployeeButton({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const hrPlus = companies.find((company) => isHrPlus(company.name));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState(hrPlus?.id || "");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function close() {
    if (busy) return;
    setOpen(false);
    setName("");
    setEmail("");
    setCompanyId(hrPlus?.id || "");
    setEmploymentType("FULL_TIME");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, companyId, employmentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Something went wrong."));
      router.push(`/hr/employees/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary shrink-0">
        <UserPlus size={15} /> {t("Invite employee")}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 animate-fade-in">
            <div className="card p-6 max-w-md w-full flex flex-col gap-4 animate-scale-in">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{t("Invite an Employee")}</h2>
                <p className="text-sm text-ink-muted mt-1">
                  {t("Creates a record and emails them a link to fill in their own personal details — HKID, address, emergency contact, and bank info.")}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={submit} className="flex flex-col gap-3">
                <div>
                  <label className="label">{t("Name")}</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="label">{t("Email address")}</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">{t("Company")}</label>
                  <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    {!hrPlus && <option value="">{t("HR Plus")}</option>}
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t("Employment type")}</label>
                  <select className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                    <option value="FULL_TIME">{t("Full time")}</option>
                    <option value="PART_TIME">{t("Part time")}</option>
                    <option value="FREELANCE">{t("Freelance")}</option>
                  </select>
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-primary flex-1 min-w-0 justify-center"
                  >
                    {busy ? (
                      <Loader2 size={15} className="animate-spin shrink-0" />
                    ) : (
                      <UserPlus size={15} className="shrink-0" />
                    )}
                    <span className="truncate">{busy ? t("Sending…") : t("Create & send invite")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="btn-secondary flex-1 min-w-0 justify-center"
                  >
                    <span className="truncate">{t("Cancel")}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
