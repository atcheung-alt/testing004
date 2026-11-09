"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { employeeNameMatches } from "@/lib/employeeName";
import { useT } from "@/lib/i18n/client";

type Person = {
  employeeId: string;
  entryId: string | null;
  name: string;
  note: string;
};

export default function PayrollMonthEditor({
  runId,
  periodLabel,
  people,
}: {
  runId: string;
  periodLabel: string;
  people: Person[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = people.filter((person) => employeeNameMatches(person.name, query));
  const missing = visible.filter((person) => !person.entryId);
  const present = visible.filter((person) => person.entryId);

  async function add(employeeId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/payroll/${runId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("Could not add this person."));
      return;
    }
    router.refresh();
  }

  async function remove(person: Person) {
    if (!person.entryId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/payroll/${runId}/entries/${person.entryId}`, { method: "DELETE" });
    setBusy(false);
    setRemoveId(null);
    if (!res.ok) {
      setError(t("Could not remove this person."));
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        {t("Edit")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="card flex max-h-[min(720px,100%)] w-full max-w-lg flex-col p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              {t("Edit {period}", { period: periodLabel })}
            </h2>
            <input
              className="input mt-3"
              type="search"
              value={query}
              placeholder={t("Search by name")}
              aria-label={t("Search by name")}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="mt-3 flex-1 overflow-auto">
              {missing.length === 0 && present.length === 0 ? (
                <p className="py-6 text-sm text-ink-muted">{t("No matching names.")}</p>
              ) : (
                <>
                  {(missing.length > 0 || !query.trim()) && (
                  <section>
                    <p className="text-xs font-semibold text-ink-muted">{t("Not on this payroll")}</p>
                    {missing.length === 0 ? (
                      <p className="py-2 text-sm text-ink-muted">{t("No one to add.")}</p>
                    ) : (
                      missing.map((person) => (
                        <div key={person.employeeId} className="flex items-center justify-between gap-3 border-b border-line/70 py-2">
                          <p className="font-medium text-ink">{person.name}</p>
                          <button type="button" className="btn-primary !px-3 !py-1 text-xs" disabled={busy} onClick={() => add(person.employeeId)}>
                            {t("Add")}
                          </button>
                        </div>
                      ))
                    )}
                  </section>
                  )}
                  {present.length > 0 && (
                    <section className="mt-4">
                      <p className="text-xs font-semibold text-ink-muted">{t("On this payroll")}</p>
                      {present.map((person) => (
                        <div key={person.employeeId} className="flex items-center justify-between gap-3 border-b border-line/70 py-2">
                          <p className="font-medium text-ink">{person.name}</p>
                          <button type="button" className="btn-danger !px-3 !py-1 text-xs" disabled={busy} onClick={() => setRemoveId(person)}>
                            {t("Remove")}
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                {t("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
      {removeId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 px-4">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-display text-lg font-semibold text-ink">{t("Remove from this payroll?")}</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t("{name} will leave {period} only. Their employee record stays.", {
                name: removeId.name,
                period: periodLabel,
              })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRemoveId(null)}>
                {t("Not now")}
              </button>
              <button type="button" className="btn-secondary text-rose-700" disabled={busy} onClick={() => remove(removeId)}>
                {t("Yes, remove")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
