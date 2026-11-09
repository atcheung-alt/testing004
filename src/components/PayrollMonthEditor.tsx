"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        {t("Edit")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              {t("Edit {period}", { period: periodLabel })}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t("Add or remove people for this month only. Their employee record stays.")}
            </p>
            <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-auto">
              {people.map((person) => (
                <div key={person.employeeId} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                  <div>
                    <p className="font-medium text-ink">{person.name}</p>
                    <p className="text-xs text-ink-muted">{person.note}</p>
                  </div>
                  {person.entryId ? (
                    <button type="button" className="btn-secondary text-rose-700" disabled={busy} onClick={() => setRemoveId(person)}>
                      {t("Remove")}
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" disabled={busy} onClick={() => add(person.employeeId)}>
                      {t("Add")}
                    </button>
                  )}
                </div>
              ))}
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
