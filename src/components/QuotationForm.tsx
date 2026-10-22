"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerFields, { emptyCustomer } from "@/components/CustomerFields";
import LineItemsEditor, { emptyLineItem } from "@/components/LineItemsEditor";
import DocumentMetaFields from "@/components/DocumentMetaFields";
import NewCustomerPrompt, { type PromptCustomer } from "@/components/NewCustomerPrompt";
import {
  DEFAULT_PAYMENT_DUE_DAYS,
  DEFAULT_REMINDER_TEMPLATES,
  DEFAULT_TERMS_TEMPLATES,
  renderTerms,
  type DocumentLanguage,
} from "@/lib/settings";
import type { Quotation, LineItem, CustomerDetails } from "@/types";
import { computeTotals } from "@/lib/calculations";
import ColleagueShareFields, {
  emptyColleagueShare,
  type ColleagueShare,
  type ShareMode,
} from "@/components/ColleagueShareFields";
import { useT } from "@/lib/i18n/client";
import type { StaffColleague } from "@/lib/staffCode";

export type QuotationFormPreset = {
  templateName: string;
  title: string;
  notes?: string | null;
  terms?: string | null;
  reminder?: string | null;
  paymentDueDays?: number;
  language?: string;
  taxRate?: number;
  discount?: number;
  repeatCount?: number;
  items?: LineItem[];
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function QuotationForm({
  quotation,
  preset,
  customer: initialCustomer,
  defaultPreparedBy = "",
  colleagues = [],
  viewerEmails: initialViewerEmails = "",
}: {
  quotation?: Quotation;
  preset?: QuotationFormPreset;
  customer?: CustomerDetails;
  defaultPreparedBy?: string;
  colleagues?: StaffColleague[];
  viewerEmails?: string;
}) {
  const t = useT();
  const router = useRouter();
  const source = quotation || preset;
  const [customer, setCustomer] = useState<CustomerDetails>(
    quotation
      ? {
          customerName: quotation.customerName,
          customerContact: quotation.customerContact || "",
          customerEmail: quotation.customerEmail || "",
          customerPhone: quotation.customerPhone || "",
          customerAddress: quotation.customerAddress || "",
        }
      : initialCustomer
        ? { ...emptyCustomer(), ...initialCustomer }
        : emptyCustomer()
  );
  const [title, setTitle] = useState(source?.title || "");
  const [issueDate, setIssueDate] = useState(
    toDateInput(quotation?.issueDate) || toDateInput(new Date().toISOString())
  );
  const [expiryDate, setExpiryDate] = useState(toDateInput(quotation?.expiryDate));
  const [items, setItems] = useState<LineItem[]>(
    source?.items?.length ? source.items.map((i) => ({ ...i })) : [emptyLineItem()]
  );
  const [taxRate, setTaxRate] = useState(source?.taxRate ?? 0);
  const [discount, setDiscount] = useState(source?.discount ?? 0);
  const [repeatCount, setRepeatCount] = useState(source?.repeatCount ?? 1);
  const [notes, setNotes] = useState(source?.notes || "");
  const [preparedBy, setPreparedBy] = useState(quotation?.preparedBy || defaultPreparedBy);
  const [viewerEmails, setViewerEmails] = useState(initialViewerEmails);
  const [shareMode, setShareMode] = useState<ShareMode>(
    quotation?.shareMode === "PERCENT" ? "PERCENT" : "AMOUNT"
  );
  const [shares, setShares] = useState<ColleagueShare[]>(
    quotation?.shares?.length
      ? quotation.shares.map((share) => emptyColleagueShare(share.colleagueName, share.value))
      : [emptyColleagueShare()]
  );

  // Which language the Reminder/Terms text (and the generated PDF's static
  // labels) are in — see DocumentLanguage in src/lib/settings.ts.
  const [language, setLanguage] = useState<DocumentLanguage>(
    (source?.language as DocumentLanguage) || "EN"
  );

  // Payment window drives the standardized terms wording.
  const initialDueDays = source?.paymentDueDays ?? DEFAULT_PAYMENT_DUE_DAYS;
  const [paymentDueDays, setPaymentDueDays] = useState(initialDueDays);
  const [reminder, setReminder] = useState(
    source?.reminder || DEFAULT_REMINDER_TEMPLATES[language]
  );
  const [terms, setTerms] = useState(
    source?.terms || renderTerms(DEFAULT_TERMS_TEMPLATES[language], initialDueDays)
  );
  // Track whether the user has hand-edited the terms away from the standard
  // wording; if not (including on an existing quotation that still has the
  // untouched standard template), keep them in sync with the payment-due-days
  // field automatically.
  const [termsDirty, setTermsDirty] = useState(
    Boolean(source?.terms) &&
      source!.terms !== renderTerms(DEFAULT_TERMS_TEMPLATES[language], initialDueDays)
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingNewCustomer, setPendingNewCustomer] = useState<PromptCustomer | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Sections a validation failure might need to point back to. These are
  // always mounted (unlike the error banner, which only appears once
  // `error` is set), so scrolling to them works reliably even though it's
  // triggered in the same tick as the setError call that reveals the message.
  const customerSectionRef = useRef<HTMLDivElement>(null);
  const lineItemsSectionRef = useRef<HTMLDivElement>(null);

  function scrollToSection(ref: React.RefObject<HTMLElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handlePaymentDueDaysChange(days: number) {
    setPaymentDueDays(days);
    if (!termsDirty) {
      setTerms(renderTerms(DEFAULT_TERMS_TEMPLATES[language], days));
    }
  }

  // Deliberately regenerates both Reminder and Terms from the new language's
  // template even if termsDirty — a "start fresh in this language" action,
  // same as RecruitmentAgreementForm's handleLanguageChange.
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
      setError("Please enter the company name.");
      scrollToSection(customerSectionRef);
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      setError("Every line item needs a name.");
      scrollToSection(lineItemsSectionRef);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        ...customer,
        issueDate,
        expiryDate: expiryDate || null,
        items,
        taxRate,
        discount,
        repeatCount,
        notes,
        reminder,
        terms,
        language,
        paymentDueDays,
        preparedBy,
        shareMode,
        shares: shares.map(({ colleagueName, value }) => ({ colleagueName, value })),
        viewerEmails: viewerEmails
          .split(/[\s,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      };
      const res = await fetch(quotation ? `/api/quotations/${quotation.id}` : "/api/quotations", {
        method: quotation ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      const redirectTo = `/quotations/${data.id}`;
      const customerEmail = (customer.customerEmail || "").trim();

      // Only prompt on a brand-new quotation (not an edit) and only when
      // there's an email to match against — that's the library's dedupe key.
      if (!quotation && customerEmail) {
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
      // A server-side rejection (e.g. an API-side validation check the
      // client-side one above didn't catch) surfaces in the banner at the
      // very top of the form — but the submit button that triggered it is
      // way down at the bottom, so jump back up to make sure it's seen.
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
          {t(error)}
        </div>
      )}

      {preset && !quotation && (
        <div className="rounded-md border border-line bg-brand-50 px-4 py-3 text-sm text-ink">
          {t("Using template “{name}”. Change the activity name, the items, and the dates, then add the customer.", {
            name: preset.templateName,
          })}
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

      <ColleagueShareFields
        preparedBy={preparedBy}
        onPreparedByChange={setPreparedBy}
        shareMode={shareMode}
        onShareModeChange={setShareMode}
        shares={shares}
        onSharesChange={setShares}
        total={computeTotals(items, taxRate, discount, repeatCount).total}
        colleagues={colleagues}
      />

      <div className="card p-5" ref={customerSectionRef}>
        <h2 className="font-display text-lg font-semibold mb-4">{t("Company Information")}</h2>
        <CustomerFields value={customer} onChange={setCustomer} showContactAndPhone={false} />
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
          <label className="label">{t("Valid until")}</label>
          <input
            type="date"
            className="input"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-visible p-5" ref={lineItemsSectionRef}>
        <h2 className="font-display text-lg font-semibold mb-4">{t("Line Items")}</h2>
        <LineItemsEditor
          items={items}
          onItemsChange={setItems}
          taxRate={taxRate}
          onTaxRateChange={setTaxRate}
          discount={discount}
          onDiscountChange={setDiscount}
          repeatCount={repeatCount}
          onRepeatCountChange={setRepeatCount}
        />
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-1">{t("Also let these people see it")}</h2>
        <p className="text-xs text-ink-faint mb-3">
          {t("Freelance accounts only see documents they created. Type their email here, separated by commas, to let them open this quotation and its files.")}
        </p>
        <input
          className="input"
          value={viewerEmails}
          placeholder="name@company.com"
          onChange={(e) => setViewerEmails(e.target.value)}
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
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t("Saving…") : quotation ? t("Save changes") : t("Create quotation")}
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
