"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type InvoiceOption = {
  id: string;
  number: string;
  title: string;
  customerName: string;
};

function invoiceLabel(invoice: InvoiceOption): string {
  const who = invoice.customerName || invoice.title;
  return who ? `${invoice.number} · ${who}` : invoice.number;
}

export function EnableMassageQuestionnaireButton({ bookingEventId }: { bookingEventId: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/events/${bookingEventId}/questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: true }),
      });
      if (!response.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError(t("Could not create the guest questionnaire."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className="btn-primary" onClick={enable} disabled={busy}>
        {busy ? t("Creating…") : t("Create guest QR code")}
      </button>
      {error ? <p className="text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}

export function MassageInvoiceField({
  bookingEventId,
  invoices,
  currentId,
}: {
  bookingEventId: string;
  invoices: InvoiceOption[];
  currentId: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [invoiceId, setInvoiceId] = useState(currentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? invoices.filter((invoice) => invoiceLabel(invoice).toLowerCase().includes(needle))
      : invoices;
    const slice = matched.slice(0, 40);
    if (invoiceId && !slice.some((invoice) => invoice.id === invoiceId)) {
      const selected = invoices.find((invoice) => invoice.id === invoiceId);
      if (selected) slice.unshift(selected);
    }
    return slice;
  }, [invoices, invoiceId, query]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/events/${bookingEventId}/questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoiceId || null }),
      });
      if (response.status === 409) {
        setError(t("That invoice is already linked to another massage."));
        return;
      }
      if (!response.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError(t("Could not save the invoice link."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 max-w-md">
      <label className="label" htmlFor={`massage-invoice-${bookingEventId}`}>
        {t("Linked invoice")}
      </label>
      <input
        type="search"
        className="input"
        value={query}
        aria-label={t("Search by invoice number or client")}
        placeholder={t("Search by invoice number or client")}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        id={`massage-invoice-${bookingEventId}`}
        className="input"
        value={invoiceId}
        onChange={(event) => setInvoiceId(event.target.value)}
      >
        <option value="">{t("No invoice yet")}</option>
        {shown.map((invoice) => (
          <option key={invoice.id} value={invoice.id}>
            {invoiceLabel(invoice)}
          </option>
        ))}
      </select>
      <div>
        <button type="button" className="btn-secondary" onClick={save} disabled={busy || invoiceId === (currentId ?? "")}>
          {busy ? t("Saving…") : t("Save invoice link")}
        </button>
      </div>
      {error ? <p className="text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}
