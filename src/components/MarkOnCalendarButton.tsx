"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, CalendarCheck, X } from "lucide-react";
import Portal from "@/components/Portal";
import { useT } from "@/lib/i18n/client";

export default function MarkOnCalendarButton({
  invoiceId,
  markedEventName,
}: {
  invoiceId: string;
  /** Non-null once this invoice already has an Event row — see
   *  getEventForInvoice in src/lib/events.ts. Renders a confirmation
   *  instead of the button when set. */
  markedEventName: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justMarkedAs, setJustMarkedAs] = useState<string | null>(null);

  const marked = markedEventName ?? justMarkedAs;
  if (marked) {
    return (
      <p className="text-sm text-brand-600 flex items-center gap-1.5">
        <CalendarCheck size={15} /> {t("On the calendar as \"{name}\" —", { name: marked })}{" "}
        <Link href="/bookings" className="underline">
          {t("view on Bookings")}
        </Link>
      </p>
    );
  }

  async function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter an event name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark this on the calendar.");
      setJustMarkedAs(trimmed);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <CalendarPlus size={15} /> {t("Mark on Calendar")}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
              onClick={() => !saving && setOpen(false)}
            />
            <div className="relative w-full max-w-sm card p-6 animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">{t("Mark on Calendar")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-ink-faint hover:text-ink"
                  aria-label={t("Close")}
                >
                  <X size={18} />
                </button>
              </div>

              <label className="label">{t("Event name")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. Annual Wellness Day")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {error && <p className="text-sm text-danger-600 mt-2">{t(error)}</p>}

              <div className="flex gap-3 justify-end mt-5">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary" disabled={saving}>
                  {t("Cancel")}
                </button>
                <button type="button" onClick={handleConfirm} disabled={saving} className="btn-primary">
                  {saving ? t("Saving…") : t("Add to calendar")}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
