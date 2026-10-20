"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomerFields, { emptyCustomer } from "@/components/CustomerFields";
import LineItemsEditor, { emptyLineItem } from "@/components/LineItemsEditor";
import DocumentMetaFields from "@/components/DocumentMetaFields";
import NewCustomerPrompt, { type PromptCustomer } from "@/components/NewCustomerPrompt";
import { formatDate } from "@/lib/calculations";
import {
  DEFAULT_PAYMENT_DUE_DAYS,
  DEFAULT_REMINDER_TEMPLATES,
  DEFAULT_TERMS_TEMPLATES,
  renderTerms,
  type DocumentLanguage,
} from "@/lib/settings";
import type { Invoice, LineItem, CustomerDetails } from "@/types";
import { useT } from "@/lib/i18n/client";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * The due date is never entered directly — it's always the issue date plus
 * the payment window (see computeDueDate in src/lib/document-helpers.ts,
 * which the server uses to compute the value actually saved). This mirrors
 * that calculation purely for display, so staff can see the resulting date
 * update live as they adjust either input, before saving.
 */
function computeDueDateLabel(issueDateInput: string, paymentDueDays: number): string {
  if (!issueDateInput) return "—";
  const issue = new Date(issueDateInput);
  if (Number.isNaN(issue.getTime())) return "—";
  const due = new Date(issue.getTime() + paymentDueDays * 24 * 60 * 60 * 1000);
  return formatDate(due);
}

export default function InvoiceForm({
  invoice,
  customer: initialCustomer,
  calendarEventName: initialCalendarName,
}: {
  invoice?: Invoice;
  customer?: CustomerDetails;
  calendarEventName?: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const [customer, setCustomer] = useState<CustomerDetails>(
    invoice
      ? {
          customerName: invoice.customerName,
          customerContact: invoice.customerContact || "",
          customerEmail: invoice.customerEmail || "",
          customerPhone: invoice.customerPhone || "",
          customerAddress: invoice.customerAddress || "",
        }
      : initialCustomer
        ? { ...emptyCustomer(), ...initialCustomer }
        : emptyCustomer()
  );
  const [title, setTitle] = useState(invoice?.title || "");
  const [poNumber, setPoNumber] = useState(invoice?.poNumber || "");
  const [issueDate, setIssueDate] = useState(
    toDateInput(invoice?.issueDate) || toDateInput(new Date().toISOString())
  );
  const [eventStartDate, setEventStartDate] = useState(toDateInput(invoice?.eventStartDate));
  const [eventStartTime, setEventStartTime] = useState(invoice?.eventStartTime || "");
  const [eventEndDate, setEventEndDate] = useState(toDateInput(invoice?.eventEndDate));
  const [eventEndTime, setEventEndTime] = useState(invoice?.eventEndTime || "");
  const [markOnCalendar, setMarkOnCalendar] = useState(Boolean(initialCalendarName));
  const [calendarEventName, setCalendarEventName] = useState(initialCalendarName || "");
  const [items, setItems] = useState<LineItem[]>(
    invoice?.items?.length ? invoice.items.map((i) => ({ ...i })) : [emptyLineItem()]
  );
  const [taxRate, setTaxRate] = useState(invoice?.taxRate ?? 0);
  const [discount, setDiscount] = useState(invoice?.discount ?? 0);
  const [notes, setNotes] = useState(invoice?.notes || "");

  const [language, setLanguage] = useState<DocumentLanguage>(
    (invoice?.language as DocumentLanguage) || "EN"
  );

  const initialDueDays = invoice?.paymentDueDays ?? DEFAULT_PAYMENT_DUE_DAYS;
  const [paymentDueDays, setPaymentDueDays] = useState(initialDueDays);
  const [reminder, setReminder] = useState(invoice?.reminder || DEFAULT_REMINDER_TEMPLATES[language]);
  const [terms, setTerms] = useState(
    invoice?.terms || renderTerms(DEFAULT_TERMS_TEMPLATES[language], initialDueDays)
  );
  const [termsDirty, setTermsDirty] = useState(
    Boolean(invoice?.terms) &&
      invoice!.terms !== renderTerms(DEFAULT_TERMS_TEMPLATES[language], initialDueDays)
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingNewCustomer, setPendingNewCustomer] = useState<PromptCustomer | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Not saved directly — the server always derives the actual dueDate from
  // issueDate + paymentDueDays (see computeDueDate). This is purely a live
  // preview so staff see the resulting date as they edit either input.
  const dueDateLabel = computeDueDateLabel(issueDate, paymentDueDays);

  function handlePaymentDueDaysChange(days: number) {
    setPaymentDueDays(days);
    if (!termsDirty) {
      setTerms(renderTerms(DEFAULT_TERMS_TEMPLATES[language], days));
    }
  }

  // Deliberately regenerates both Reminder and Terms from the new language's
  // template even if termsDirty — same "start fresh in this language" idea
  // as QuotationForm's handleLanguageChange.
  function handleLanguageChange(value: DocumentLanguage) {
    setLanguage(value);
    setTermsDirty(false);
    setTerms(renderTerms(DEFAULT_TERMS_TEMPLATES[value], paymentDueDays));
    setReminder(DEFAULT_REMINDER_TEMPLATES[value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customer.customerName.trim()) {
      setError(t("Please enter the company name."));
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      setError(t("Every line item needs a name."));
      return;
    }
    if (eventStartDate && eventEndDate && eventEndDate < eventStartDate) {
      setError(t("Event end date must be on or after the start date."));
      return;
    }
    if (markOnCalendar && (!eventStartDate || !eventEndDate)) {
      setError(t("Set both an event start and end date before marking it on the Bookings calendar."));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        poNumber: poNumber.trim() || null,
        ...customer,
        issueDate,
        eventStartDate: eventStartDate || null,
        eventStartTime: eventStartTime || null,
        eventEndDate: eventEndDate || null,
        eventEndTime: eventEndTime || null,
        markOnCalendar,
        calendarEventName: calendarEventName.trim() || title.trim() || customer.customerName.trim(),
        items,
        taxRate,
        discount,
        notes,
        reminder,
        terms,
        language,
        paymentDueDays,
      };
      const res = await fetch(invoice ? `/api/invoices/${invoice.id}` : "/api/invoices", {
        method: invoice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Something went wrong."));

      const redirectTo = `/invoices/${data.id}`;
      const customerEmail = (customer.customerEmail || "").trim();

      // Only prompt on a brand-new invoice (not an edit) and only when
      // there's an email to match against — that's the library's dedupe key.
      if (!invoice && customerEmail) {
        try {
          const checkRes = await fetch(`/api/customers/check?email=${encodeURIComponent(customerEmail)}`);
          const checkData = await checkRes.json();
          if (checkRes.ok && !checkData.exists) {
            setPendingNewCustomer({
              customerName: customer.customerName,
              customerContact: customer.customerContact || "",
              customerEmail,
              customerPhone: customer.customerPhone || "",
              customerAddress: customer.customerAddress || "",
            });
            setPendingRedirect(redirectTo);
            return; // hold off navigating until the prompt is resolved
          }
        } catch {
          // If the check itself fails, don't block the user — just proceed.
        }
      }

      router.push(redirectTo);
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
        <label className="label">{t("Title / subject")}</label>
        <input
          type="text"
          className="input"
          placeholder={t("e.g. HR Management System")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="card p-5">
        <label className="label">{t("PO Number (optional)")}</label>
        <input
          type="text"
          className="input"
          placeholder={t("e.g. PO4225")}
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
        />
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Customer")}</h2>
        <CustomerFields value={customer} onChange={setCustomer} />
      </div>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">{t("Issue date")}</label>
          <input
            type="date"
            className="input"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("Due date")}</label>
          <p className="input flex items-center bg-paper text-ink-muted cursor-default">{dueDateLabel}</p>
          <p className="mt-1.5 text-xs text-ink-faint">{t("Calculated automatically from the issue date and payment terms below.")}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Event Date & Time")}</h2>
        <p className="text-xs text-ink-faint mb-4">{t("Optional. Tick the box to show this job as a grey bar on the Bookings calendar.")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("Event start date")}</label>
            <input
              type="date"
              className="input"
              value={eventStartDate}
              onChange={(e) => setEventStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Event start time")}</label>
            <input
              type="time"
              className="input"
              value={eventStartTime}
              onChange={(e) => setEventStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Event end date")}</label>
            <input
              type="date"
              className="input"
              value={eventEndDate}
              min={eventStartDate || undefined}
              onChange={(e) => setEventEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Event end time")}</label>
            <input
              type="time"
              className="input"
              value={eventEndTime}
              onChange={(e) => setEventEndTime(e.target.value)}
            />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={markOnCalendar}
            onChange={(e) => {
              const checked = e.target.checked;
              setMarkOnCalendar(checked);
              if (checked && !calendarEventName.trim()) {
                setCalendarEventName(title.trim() || customer.customerName.trim());
              }
            }}
          />
          {t("Show this on the Bookings calendar")}
        </label>
        {markOnCalendar && (
          <div className="mt-3 max-w-md">
            <label className="label">{t("Event name")}</label>
            <input
              type="text"
              className="input"
              value={calendarEventName}
              placeholder={t("e.g. Annual Wellness Day")}
              onChange={(e) => setCalendarEventName(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="card p-5 overflow-visible">
        <h2 className="font-display text-lg font-semibold mb-1">{t("Line Items")}</h2>
        <p className="text-sm text-ink-muted mb-4">{t("Click the item name and search items you have billed before, or the item library. Click a result to fill the line — you can still edit anything afterwards.")}</p>
        <LineItemsEditor
          items={items}
          onItemsChange={setItems}
          taxRate={taxRate}
          onTaxRateChange={setTaxRate}
          discount={discount}
          onDiscountChange={setDiscount}
        />
      </div>

      <DocumentMetaFields
        notes={notes}
        onNotesChange={setNotes}
        paymentDueDays={paymentDueDays}
        onPaymentDueDaysChange={handlePaymentDueDaysChange}
        reminder={reminder}
        onReminderChange={setReminder}
        terms={terms}
        onTermsChange={(v) => {
          setTerms(v);
          setTermsDirty(true);
        }}
        showReminderAndTerms={false}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t("Saving…") : invoice ? t("Save changes") : t("Create invoice")}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          {t("Cancel")}
        </button>
      </div>

      {pendingNewCustomer && pendingRedirect && (
        <NewCustomerPrompt
          customer={pendingNewCustomer}
          onDone={() => {
            router.push(pendingRedirect);
            router.refresh();
          }}
        />
      )}
    </form>
  );
}
