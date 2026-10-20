"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/lib/i18n/client";

type Therapist = { id: string; name: string };

export default function MassageRoster({ therapists }: { therapists: Therapist[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Enter a therapist name."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/massage/therapists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (response.status === 409) {
        setError(t("This therapist is already on the list."));
        return;
      }
      if (!response.ok) {
        setError(t("Could not update the therapist list."));
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError(t("Could not update the therapist list."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/massage/therapists/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(t("Could not update the therapist list."));
        return;
      }
      setPendingId(null);
      router.refresh();
    } catch {
      setError(t("Could not update the therapist list."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        className="card px-4 sm:px-5 py-4 flex items-center justify-between gap-3 text-left w-full"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="font-display text-xl font-semibold block">{t("Current therapists")}</span>
          <span className="text-sm text-ink-muted mt-1 block">
            {t("{count} names guests can choose", { count: therapists.length })}
          </span>
        </span>
        <ChevronDown size={18} className={clsx("shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
      <div className="card divide-y divide-line">
        <p className="px-4 sm:px-5 py-4 text-sm text-ink-muted">
          {t(
            "Add or remove names guests can choose. Removing a name hides them from new surveys. Past scores stay on the event."
          )}
        </p>
        <form onSubmit={add} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row gap-2">
          <label className="sr-only" htmlFor="therapist-name">
            {t("Therapist name")}
          </label>
          <input
            id="therapist-name"
            className="input flex-1"
            value={name}
            maxLength={80}
            placeholder={t("e.g. Amy")}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={busy}>
            {t("Add therapist")}
          </button>
        </form>
        {therapists.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 text-sm text-ink-muted">{t("No therapists yet")}</p>
        ) : (
          therapists.map((therapist) => (
            <div key={therapist.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
              <p className="font-medium min-w-0 truncate">{therapist.name}</p>
              {pendingId === therapist.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="btn-danger" disabled={busy} onClick={() => remove(therapist.id)}>
                    {t("Confirm remove")}
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => setPendingId(null)}>
                    {t("Cancel")}
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-secondary shrink-0" onClick={() => setPendingId(therapist.id)}>
                  {t("Remove")}
                </button>
              )}
            </div>
          ))
        )}
        {error ? <p className="px-4 sm:px-5 py-3 text-sm text-danger-500">{error}</p> : null}
      </div>
      ) : null}
    </section>
  );
}
