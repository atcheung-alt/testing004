"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { categoryLabel } from "@/lib/ensureExpenseCategories";
import { useT } from "@/lib/i18n/client";
import CategorySelect from "@/components/CategorySelect";
import StatusBadge from "@/components/StatusBadge";

export type ExpenseInvoiceChoice = {
  id: string;
  number: string;
  customerName: string;
  title?: string;
  total?: number;
  issueLabel?: string;
  poNumber?: string | null;
  displayStatus?: string;
  customerEmail?: string | null;
};

export type ExpenseListRow = {
  id: string;
  category: string;
  label: string;
  amount: number;
  createdLabel: string;
  invoice: ExpenseInvoiceChoice;
  documents: { id: string; fileName: string }[];
};

type PickedFile = { fileName: string; data: string };

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export default function ExpenseWorkspace({
  invoices,
  categories,
  expenses,
  initialInvoiceId,
}: {
  invoices: ExpenseInvoiceChoice[];
  categories: string[];
  expenses: ExpenseListRow[];
  initialInvoiceId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const options = categories.length ? [...categories, "Others"] : ["Others"];
  const preset = invoices.find((invoice) => invoice.id === initialInvoiceId) || null;

  const [invoiceQuery, setInvoiceQuery] = useState(preset ? `${preset.number} · ${preset.customerName}` : "");
  const [invoiceId, setInvoiceId] = useState(preset?.id || "");
  const [openList, setOpenList] = useState(false);
  const [category, setCategory] = useState(options[0] || "Others");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase();
    const pool = q
      ? invoices.filter((invoice) =>
          [invoice.number, invoice.customerName, invoice.title, invoice.poNumber, invoice.issueLabel]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : invoices;
    return pool.slice(0, 8);
  }, [invoiceQuery, invoices]);

  const selected = invoices.find((invoice) => invoice.id === invoiceId) || null;

  const shown = useMemo(() => {
    if (invoiceId) return expenses.filter((row) => row.invoice.id === invoiceId);
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((row) =>
      [row.invoice.number, row.invoice.customerName].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [expenses, invoiceId, invoiceQuery]);
  const isOthers = category === "Others";

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    if (files.length + incoming.length > MAX_FILES) {
      setError(t("You can attach up to {count} files to one expense.", { count: MAX_FILES }));
      return;
    }
    const tooBig = incoming.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      setError(t("\"{name}\" is larger than {size}MB.", { name: tooBig.name, size: MAX_BYTES / (1024 * 1024) }));
      return;
    }
    const unsupported = incoming.find(
      (file) => !/^image\/(jpeg|png|webp|gif)$/.test(file.type) && file.type !== "application/pdf"
    );
    if (unsupported) {
      setError(t("\"{name}\" must be a PDF or an image.", { name: unsupported.name }));
      return;
    }
    setError(null);
    const picked = await Promise.all(incoming.map(async (file) => ({ fileName: file.name, data: await readFileAsDataUrl(file) })));
    setFiles((prev) => [...prev, ...picked]);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId) {
      setError(t("Choose the invoice this expense belongs to."));
      return;
    }
    if (isOthers && !label.trim()) {
      setError(t("Please describe this expense."));
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError(t("Please enter a valid amount."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          label: label.trim(),
          amount: parsedAmount,
          documents: files,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not add the expense."));
      setLabel("");
      setAmount("");
      setFiles([]);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(row: ExpenseListRow) {
    setDeletingId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${row.invoice.id}/expenses/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove the expense."));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={saveExpense} className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("Record an expense")}</h2>
          <p className="lead">
            {t("Choose the invoice, then attach a PDF or photo. Clients do not see these files.")}
          </p>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
            {t(error)}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="label">{t("Related invoice")}</label>
            <input
              className="input"
              value={invoiceQuery}
              placeholder={t("Search number, customer, or activity")}
              onChange={(e) => {
                setInvoiceQuery(e.target.value);
                setInvoiceId("");
                setOpenList(true);
              }}
              onFocus={() => setOpenList(true)}
              onBlur={() => window.setTimeout(() => setOpenList(false), 150)}
            />
            {selected && (
              <div className="mt-2 rounded-md bg-paper px-3 py-2 text-sm">
                <p className="font-medium text-ink truncate">{selected.customerName}</p>
                <p className="text-ink-muted truncate">{selected.title || t("No activity name")}</p>
                <p className="text-xs text-ink-faint mt-0.5">
                  {[selected.issueLabel, typeof selected.total === "number" ? formatCurrency(selected.total) : "", selected.poNumber ? `PO ${selected.poNumber}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            )}
            {openList && (
              <div className="mt-1 w-full card max-h-80 overflow-auto py-1">
                {!invoiceQuery.trim() && matches.length > 0 && (
                  <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    {t("Recent invoices")}
                  </p>
                )}
                {matches.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-ink-muted">{t("No matching invoice.")}</p>
                ) : (
                  matches.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-paper"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setInvoiceId(invoice.id);
                        setInvoiceQuery(`${invoice.number} · ${invoice.customerName}`);
                        setOpenList(false);
                      }}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-sm font-medium">{invoice.number}</span>
                          {invoice.displayStatus && <StatusBadge status={invoice.displayStatus} />}
                        </span>
                        {typeof invoice.total === "number" && (
                          <span className="font-mono text-sm shrink-0">{formatCurrency(invoice.total)}</span>
                        )}
                      </span>
                      <span className="block text-sm text-ink truncate">{invoice.customerName}</span>
                      <span className="block text-xs text-ink-muted truncate">
                        {[invoice.title, invoice.issueLabel, invoice.poNumber ? `PO ${invoice.poNumber}` : ""]
                          .filter(Boolean)
                          .join(" · ") || t("No activity name")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("Category")}</label>
              <CategorySelect value={category} options={options} onChange={setCategory} />
            </div>
            <div>
              <label className="label">{t("Amount")}</label>
              <input
                className="input font-mono"
                inputMode="decimal"
                value={amount}
                placeholder="0.00"
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isOthers && (
          <div>
            <label className="label">{t("Description")}</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("What was this cost for?")} />
          </div>
        )}

        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border border-dashed border-line rounded-md px-4 py-6 text-sm text-ink-muted hover:bg-paper hover:text-ink transition-colors"
          >
            <Paperclip size={16} className="inline mr-2" />
            {t("Upload PDF or photo")}
          </button>
          <p className="mt-1 text-xs text-ink-faint">
            {t("PDF or image, up to {count} files, {size}MB each.", { count: MAX_FILES, size: 8 })}
          </p>
          {files.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {files.map((file, index) => (
                <li key={`${file.fileName}-${index}`} className="flex items-center gap-2 text-sm">
                  <FileText size={14} className="text-ink-faint shrink-0" />
                  <span className="truncate">{file.fileName}</span>
                  <button
                    type="button"
                    className="ml-auto text-ink-faint hover:text-danger-500"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={t("Remove {name}", { name: file.fileName })}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <button type="submit" className="btn-primary" disabled={saving || invoices.length === 0}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("Save expense")}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t("Recorded expenses")}</h2>
          {(invoiceId || invoiceQuery.trim()) && (
            <button
              type="button"
              className="text-sm text-brand-500 hover:text-brand-600"
              onClick={() => {
                setInvoiceId("");
                setInvoiceQuery("");
              }}
            >
              {t("Show all expenses")}
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <div className="card px-5 py-8 text-sm text-ink-muted text-center">
            {invoiceId || invoiceQuery.trim()
              ? t("No expenses logged for this invoice yet.")
              : t("No expenses yet. Record one above and it will stay linked to the invoice you chose.")}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <div className="min-w-[44rem] divide-y divide-line">
            <div className="grid grid-cols-[9rem_minmax(12rem,1fr)_10rem_7rem_2rem] gap-3 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <span>{t("Invoice")}</span>
              <span>{t("Customer")}</span>
              <span>{t("Category")}</span>
              <span className="text-right">{t("Amount")}</span>
              <span />
            </div>
            {shown.map((row) => (
              <div key={row.id} className="px-4 sm:px-5 py-3">
                <div className="grid grid-cols-[9rem_minmax(12rem,1fr)_10rem_7rem_2rem] items-center gap-3">
                <Link href={`/invoices/${row.invoice.id}`} className="font-mono text-sm font-medium hover:text-brand-600 whitespace-nowrap">
                  {row.invoice.number}
                </Link>
                <div className="min-w-0">
                  <p className="text-sm text-ink whitespace-nowrap">{row.invoice.customerName}</p>
                  <p className="text-xs text-ink-faint whitespace-nowrap">{row.createdLabel}</p>
                  {row.documents.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {row.documents.map((doc) => (
                        <li key={doc.id}>
                          <a
                            href={`/api/invoices/${row.invoice.id}/expenses/${row.id}/documents/${doc.id}`}
                            className="text-xs text-brand-500 hover:text-brand-600 inline-flex items-center gap-1.5"
                          >
                            <FileText size={12} /> {doc.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="text-sm text-ink whitespace-nowrap">{row.category === "Others" ? row.label || t("Others") : t(categoryLabel(row.category))}</span>
                <span className="font-mono text-sm text-right whitespace-nowrap">{formatCurrency(row.amount)}</span>
                <button
                  type="button"
                  className="text-ink-faint hover:text-danger-500 justify-self-end"
                  disabled={deletingId === row.id}
                  onClick={() => void removeExpense(row)}
                  aria-label={t("Remove expense")}
                >
                  {deletingId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
