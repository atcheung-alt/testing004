"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, Download, Plus, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";

function invoiceLabel(invoice?: { number: string; customerName: string; total: number }) {
  if (!invoice) return "";
  return `${invoice.number} — ${invoice.customerName} (${formatCurrency(invoice.total)})`;
}

function issuedDate(iso: string) {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function expenseCodes(history: HistoryRow[]) {
  const byYear = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const year = row.date.slice(0, 4) || "0000";
    const list = byYear.get(year) || [];
    list.push(row);
    byYear.set(year, list);
  }
  const codes = new Map<string, string>();
  for (const [year, list] of byYear) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
    sorted.forEach((row, index) => {
      codes.set(`${row.source}-${row.id}`, `EX-${year}-${String(index + 1).padStart(4, "0")}`);
    });
  }
  return codes;
}

const CATEGORIES = [
  "Rent & Office",
  "Software & Subscriptions",
  "Marketing & Advertising",
  "Travel & Transportation",
  "Entertainment & Meals",
  "Professional Fees",
  "Office Supplies & Equipment",
  "Other (Custom)",
];

export type HistoryRow = {
  id: string;
  source: "invoice" | "general";
  name: string;
  category: string;
  amount: number;
  date: string;
  vendor: string;
  link: string;
  invoiceId: string;
  receiptHref: string;
  canDelete: boolean;
};

export default function GeneralExpenses({
  invoices,
  history,
}: {
  invoices: { id: string; number: string; customerName: string; total: number }[];
  history: HistoryRow[];
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState("");
  const [vendor, setVendor] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [askId, setAskId] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "GENERAL" | "INVOICE">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const codes = useMemo(() => expenseCodes(history), [history]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((row) => {
      const invoiceTied = row.source === "invoice" || Boolean(row.invoiceId);
      if (typeFilter === "GENERAL" && invoiceTied) return false;
      if (typeFilter === "INVOICE" && !invoiceTied) return false;
      if (from && row.date < from) return false;
      if (to && row.date > to) return false;
      if (!q) return true;
      const code = codes.get(`${row.source}-${row.id}`) || "";
      return `${row.name} ${row.vendor} ${row.category} ${code} ${row.link}`.toLowerCase().includes(q);
    });
  }, [history, query, typeFilter, from, to, codes]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const savedCategory = category === "Other (Custom)" ? customCategory.trim() : category;
      if (!savedCategory) throw new Error("Specify a custom category.");
      const response = await fetch("/api/general-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: savedCategory,
          amount,
          spentAt,
          vendor,
          notes,
          fileName,
          fileData,
          invoiceId: invoiceId || null,
          invoiceNumber: invoiceId ? invoiceNumber : "",
          expenseType: invoiceId ? "INVOICE" : "GENERAL",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save the expense.");
      setName("");
      setAmount("");
      setVendor("");
      setInvoiceId("");
      setInvoiceNumber("");
      setInvoiceQuery("");
      setCustomCategory("");
      setNotes("");
      setFileName("");
      setFileData("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the expense.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: HistoryRow) {
    if (!row.canDelete || removingId) return;
    setRemovingId(row.id);
    setError("");
    try {
      const url = row.source === "invoice"
        ? `/api/invoices/${row.invoiceId}/expenses/${row.id}`
        : `/api/general-expenses/${row.id}`;
      const response = await fetch(url, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not delete that expense.");
      setAskId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that expense.");
    } finally {
      setRemovingId("");
    }
  }

  function exportCsv(list: HistoryRow[]) {
    const header = ["Code", "Date", "Expense", "Category", "Vendor", "Amount", "Link", "Receipt"];
    const body = list.map((row) => [codes.get(`${row.source}-${row.id}`) || "", row.date, row.name, row.category, row.vendor, String(row.amount), row.link, row.receiptHref]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-filters flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Expenses")}</h1>
          <p className="lead">{t("Record a cost on an invoice, or a general expense that is not tied to one.")}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn-secondary" onClick={() => exportCsv(rows)}>
            <Download size={15} /> {t("Export CSV")}
          </button>
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> {t("New Expense")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search by vendor, code, or expense...")} />
          </div>
          <div className="flex items-center gap-2">
            <CalendarRange size={15} className="text-ink-faint shrink-0" />
            <input className="input !w-auto" type="date" aria-label={t("From date")} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-ink-faint text-sm">–</span>
            <input className="input !w-auto" type="date" aria-label={t("To date")} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            {(from || to) && (
              <button type="button" onClick={() => { setFrom(""); setTo(""); }} aria-label={t("Clear date range")} className="text-ink-faint hover:text-danger-500 transition-colors">
                <X size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "GENERAL", "INVOICE"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`stamp ${typeFilter === type ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
            >
              {type === "ALL" ? t("All") : type === "GENERAL" ? t("General Expense") : t("Invoice Expense")}
            </button>
          ))}
        </div>
      </div>
      </div>

      {open ? (
      <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" onClick={() => setOpen(false)}>
      <form onSubmit={save} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={(event) => event.stopPropagation()}>
        <div>
          <label className="label">{t("Expense name")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Office supplies")} />
        </div>
        <div>
          <label className="label">{t("Category")}</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((option) => <option key={option}>{option}</option>)}
          </select>
          {category === "Other (Custom)" ? (
            <input className="input mt-2" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder={t("Specify custom category...")} />
          ) : null}
        </div>
        <div>
          <label className="label">{t("Amount")}</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">{t("Date")}</label>
          <input className="input" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("Vendor / Payee")}</label>
          <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={t("Optional")} />
        </div>
        <div>
          <label className="label">{t("Link to Invoice")}</label>
          <input
            className="input"
            value={invoiceOpen ? invoiceQuery : (invoiceNumber ? invoiceLabel(invoices.find((invoice) => invoice.id === invoiceId)) : t("None (General Expense)"))}
            placeholder={t("None (General Expense)")}
            onFocus={() => { setInvoiceOpen(true); setInvoiceQuery(""); }}
            onChange={(e) => { setInvoiceQuery(e.target.value); setInvoiceOpen(true); }}
            onBlur={() => setTimeout(() => setInvoiceOpen(false), 150)}
          />
          {invoiceOpen ? (
            <div className="mt-1 max-h-48 overflow-auto rounded-xl border border-line bg-white">
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-paper" onMouseDown={() => { setInvoiceId(""); setInvoiceNumber(""); setInvoiceQuery(""); setInvoiceOpen(false); }}>
                {t("None (General Expense)")}
              </button>
              {invoices.filter((invoice) => {
                const q = invoiceQuery.trim().toLowerCase();
                if (!q) return true;
                return `${invoice.number} ${invoice.customerName}`.toLowerCase().includes(q);
              }).map((invoice) => (
                <button type="button" key={invoice.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-paper" onMouseDown={() => { setInvoiceId(invoice.id); setInvoiceNumber(invoice.number); setInvoiceQuery(""); setInvoiceOpen(false); }}>
                  {invoiceLabel(invoice)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <label className="label">{t("Receipt")}</label>
          <input className="input" type="file" accept="image/*,.pdf" onChange={(event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              setFileName(file.name);
              setFileData(String(reader.result || ""));
            };
            reader.readAsDataURL(file);
          }} />
        </div>
        <div className="md:col-span-2">
          <label className="label">{t("Notes")}</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…") : t("Save Expense")}</button>
          <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>{t("Cancel")}</button>
          {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        </div>
      </form>
      </div>
      ) : null}

      <div className="card divide-y divide-line">
        {rows.length === 0 ? (
          <p className="px-4 sm:px-5 py-5 text-sm text-ink-muted">{t("No matching expense.")}</p>
        ) : rows.map((row) => {
          const invoiceTied = row.source === "invoice" || Boolean(row.invoiceId);
          const code = codes.get(`${row.source}-${row.id}`) || "";
          return (
          <div key={`${row.source}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-5 hover:bg-paper">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{code}</span>
                {invoiceTied && row.invoiceId ? (
                  <Link href={`/invoices/${row.invoiceId}`} className="stamp border-brand-300 bg-brand-50/50 text-brand-600">{row.link}</Link>
                ) : (
                  <span className="stamp border-line bg-paper text-ink-muted">{t("General")}</span>
                )}
              </div>
              <p className="text-xs text-ink-muted truncate mt-0.5">
                {row.name}
                {" · "}
                {t("Issued")} {issuedDate(row.date)}
                {" · "}
                {row.category}
              </p>
              <p className="text-xs text-ink-faint truncate mt-0.5">{row.vendor || "\u00a0"}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Amount")}</p>
                <p className="font-mono text-sm font-medium text-ink">{formatCurrency(row.amount)}</p>
              </div>
              {row.receiptHref ? (
                <a className="text-sm text-brand-600 hover:underline" href={row.receiptHref} target="_blank" rel="noopener noreferrer">{t("View receipt")}</a>
              ) : null}
              {row.canDelete && askId === row.id ? (
                <span className="inline-flex items-center gap-2">
                  <button type="button" className="btn-danger" disabled={removingId === row.id} onClick={() => remove(row)}>
                    {t("Confirm")}
                  </button>
                  <button type="button" className="btn-secondary" disabled={removingId === row.id} onClick={() => setAskId("")}>
                    {t("Cancel")}
                  </button>
                </span>
              ) : row.canDelete ? (
                <button type="button" className="btn-danger" onClick={() => setAskId(row.id)}>
                  {t("Delete")}
                </button>
              ) : null}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
