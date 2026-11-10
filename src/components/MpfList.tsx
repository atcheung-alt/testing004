"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { employeeNameMatches } from "@/lib/employeeName";
import { useT } from "@/lib/i18n/client";

type Row = {
  id: string;
  name: string;
  email: string;
  status: "not" | "wait" | "saved" | "done";
  driveUrl: string | null;
};

export default function MpfList({ people }: { people: Row[] }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const visible = people.filter((person) => employeeNameMatches(person.name, query) || employeeNameMatches(person.email, query));

  async function send(id: string) {
    const ok = window.confirm(
      t("Enter this employee's name, phone, and HKID on eMPF and start the enrolment. Send this email only after that is done.")
    );
    if (!ok) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/employees/${id}/mpf/email`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error || t("Failed to send the email."));
      return;
    }
    router.refresh();
  }

  async function removeFile(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/employees/${id}/mpf/file`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    setConfirmId(null);
    if (!res.ok) {
      setError(body.error || t("Could not delete the file."));
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <input
        className="input max-w-sm"
        type="search"
        value={query}
        placeholder={t("Search by name")}
        aria-label={t("Search by name")}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">{t("Employee")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-ink-muted" colSpan={3}>{t("No matching names.")}</td>
              </tr>
            )}
            {visible.map((person) => (
              <tr key={person.id} className="border-b border-line/70">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{person.name}</p>
                  <p className="text-xs text-ink-muted">{person.email || t("No email")}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      person.status === "saved" || person.status === "done"
                        ? "bg-emerald-50 text-emerald-700"
                        : person.status === "wait"
                        ? "bg-orange-50 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {person.status === "saved"
                      ? t("Saved")
                      : person.status === "done"
                      ? t("Done")
                      : person.status === "wait"
                      ? t("Waiting")
                      : t("Not sent")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {person.status === "done" ? null : person.status === "saved" && person.driveUrl ? (
                    <span className="inline-flex gap-2">
                      <a className="btn-secondary !px-3 !py-1 text-xs" href={person.driveUrl} target="_blank" rel="noreferrer">
                        {t("Open")}
                      </a>
                      <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setConfirmId(person.id)}>
                        {t("Delete")}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary !px-3 !py-1 text-xs"
                      disabled={!person.email || busyId === person.id}
                      onClick={() => send(person.id)}
                    >
                      {busyId === person.id ? t("Sending…") : person.status === "wait" ? t("Send again") : t("Send")}
                    </button>
                  )}
                </td>
              </tr>
              {confirmId === person.id && (
                <tr>
                  <td colSpan={3} className="px-4 pb-3">
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p className="font-semibold">{t("This deletes the file forever.")}</p>
                      <p className="mt-1">
                        {t("Only the MPF file is removed, from HR Plus and from Google Drive. This person stays on the list. This cannot be undone.")}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white" disabled={busyId === person.id} onClick={() => removeFile(person.id)}>
                          {t("Delete forever")}
                        </button>
                        <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setConfirmId(null)}>
                          {t("Cancel")}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
