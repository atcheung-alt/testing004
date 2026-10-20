"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, Trash2, Loader2, AlertCircle, Paperclip, FileText, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { categoryLabel } from "@/lib/ensureExpenseCategories";
import { useT } from "@/lib/i18n/client";
import CategorySelect from "@/components/CategorySelect";

export type ExpenseDocumentRef = {
  id: string;
  fileName: string;
  mimeType: string;
};

export type InvoiceExpense = {
  id: string;
  category: string;
  label: string;
  amount: number;
  documents?: ExpenseDocumentRef[];
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

export default function InvoiceExpensesCard({
  invoiceId,
  expenses,
  invoiceTotal,
  categories,
  embedded = false,
}: {
  invoiceId: string;
  expenses: InvoiceExpense[];
  invoiceTotal: number;
  categories: string[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const options = [...categories, "Others"];
  const [category, setCategory] = useState(options[0] || "Others");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowInputRef = useRef<HTMLInputElement>(null);
  const rowTarget = useRef<string | null>(null);
  const t = useT();

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const net = invoiceTotal - total;
  const isOthers = category === "Others";

  async function pickFiles(fileList: FileList | null, existing: number): Promise<PickedFile[] | null> {
    if (!fileList || fileList.length === 0) return [];
    const incoming = Array.from(fileList);
    if (existing + incoming.length > MAX_FILES) {
      setError(t("You can attach up to {count} files to one expense.", { count: MAX_FILES }));
      return null;
    }
    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(t("\"{name}\" is larger than {size}MB.", { name: tooBig.name, size: MAX_BYTES / (1024 * 1024) }));
      return null;
    }
    const unsupported = incoming.find((f) => !/^image\/(jpeg|png|webp|gif)$/.test(f.type) && f.type !== "application/pdf");
    if (unsupported) {
      setError(t("\"{name}\" must be a PDF or an image.", { name: unsupported.name }));
      return null;
    }
    return Promise.all(incoming.map(async (f) => ({ fileName: f.name, data: await readFileAsDataUrl(f) })));
  }

  async function addExpense() {
    if (saving) return;
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

  async function removeExpense(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/expenses/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove the expense."));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function addFilesToExpense(expenseId: string, fileList: FileList | null, existing: number) {
    setError(null);
    let picked: PickedFile[] | null = null;
    try {
      picked = await pickFiles(fileList, existing);
    } catch {
      setError(t("Could not read one of the selected files."));
      return;
    }
    if (!picked || picked.length === 0) return;
    setUploadingId(expenseId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/expenses/${expenseId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: picked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not upload the file."));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function removeDocument(expenseId: string, documentId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/expenses/${expenseId}/documents/${documentId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove the file."));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className={embedded ? "p-5 flex flex-col gap-4" : "card p-5 flex flex-col gap-4"}>
      <div className="flex items-center gap-2">
        <Wallet size={17} className="text-brand-600" />
        <h2 className="font-display text-lg font-semibold">{t("Event Expenses")}</h2>
        <span className="text-xs text-ink-faint ml-auto">{t("Linked to this invoice — internal only")}</span>
      </div>
      <p className="text-sm text-ink-muted -mt-2">
        {t("Log costs against this invoice and keep the receipts with the record. Clients never see this.")}
      </p>

      {expenses.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("No expenses logged for this invoice yet.")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {expenses.map((e) => {
            const docs = e.documents || [];
            return (
              <div key={e.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm text-ink truncate block">
                      {e.category === "Others" ? e.label || t("Others") : t(categoryLabel(e.category))}
                    </span>
                    {e.category !== "Others" && e.label ? (
                      <span className="text-xs text-ink-faint">{e.label}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm text-ink-muted">{formatCurrency(e.amount)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        rowTarget.current = e.id;
                        rowInputRef.current?.click();
                      }}
                      disabled={uploadingId === e.id || docs.length >= MAX_FILES}
                      aria-label={t("Upload receipt")}
                      className="text-ink-faint hover:text-brand-600 transition-colors"
                    >
                      {uploadingId === e.id ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExpense(e.id)}
                      disabled={deletingId === e.id}
                      aria-label={t("Remove expense")}
                      className="text-ink-faint hover:text-danger-500 transition-colors"
                    >
                      {deletingId === e.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
                {docs.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {docs.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2 text-sm">
                        <FileText size={14} className="text-ink-faint shrink-0" />
                        <a
                          href={`/api/invoices/${invoiceId}/expenses/${e.id}/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-brand-600 hover:underline"
                        >
                          {doc.fileName}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeDocument(e.id, doc.id)}
                          className="text-ink-faint hover:text-danger-500 ml-auto shrink-0"
                          aria-label={t("Remove {name}", { name: doc.fileName })}
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={rowInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          const expenseId = rowTarget.current;
          const existing = expenses.find((item) => item.id === expenseId)?.documents?.length || 0;
          if (expenseId) addFilesToExpense(expenseId, event.target.files, existing);
          event.target.value = "";
        }}
      />

      {expenses.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 border-t border-line text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">{t("Total expenses")}</span>
            <span className="font-mono font-medium">{formatCurrency(total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">{t("Net (invoice total − expenses)")}</span>
            <span className={`font-mono font-medium ${net < 0 ? "text-danger-500" : "text-ink"}`}>
              {formatCurrency(net)}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="w-full sm:w-44">
            <label className="label">{t("Category")}</label>
            <CategorySelect value={category} options={options} onChange={setCategory} />
          </div>
          {isOthers && (
            <div className="flex-1">
              <label className="label">{t("Describe it")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. Parking, last-minute supplies")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          )}
          <div className="w-full sm:w-36">
            <label className="label">{t("Amount")}</label>
            <input
              type="number"
              step="any"
              min={0}
              className="input text-right"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={addExpense}
            disabled={saving || !amount || (isOthers && !label.trim())}
            className="btn-secondary shrink-0"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t("Add expense")}
          </button>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={async (event) => {
              setError(null);
              try {
                const picked = await pickFiles(event.target.files, files.length);
                if (picked) setFiles((prev) => [...prev, ...picked]);
              } catch {
                setError(t("Could not read one of the selected files."));
              }
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES}
            className="btn-ghost"
          >
            <Paperclip size={14} /> {t("Attach receipts")}
          </button>
          {files.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {files.map((file, index) => (
                <li key={`${file.fileName}-${index}`} className="flex items-center gap-2 text-sm text-ink-muted">
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{file.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    className="ml-auto text-ink-faint hover:text-danger-500"
                    aria-label={t("Remove {name}", { name: file.fileName })}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-ink-faint">
            {t("PDF or image, up to {count} files, {size}MB each. Kept with this invoice for your records.", {
              count: MAX_FILES,
              size: MAX_BYTES / (1024 * 1024),
            })}
          </p>
        </div>
      </div>

      {categories.length === 0 && (
        <p className="text-xs text-ink-faint">
          {t("Tip: add reusable categories (Venue, Staffing, Transport…) in Settings so you don't have to type them out every time.")}
        </p>
      )}
    </div>
  );
}

export function InvoiceExpensesDisclosure({
  invoiceId,
  expenses,
  invoiceTotal,
  categories,
}: {
  invoiceId: string;
  expenses: InvoiceExpense[];
  invoiceTotal: number;
  categories: string[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-paper transition-colors"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div>
          <p className="font-medium text-ink">{t("Expenses")}</p>
          <p className="text-sm text-ink-muted mt-0.5">
            {expenses.length === 0
              ? t("Record a cost and upload a receipt for this invoice.")
              : t("{count} logged · {amount}", {
                  count: expenses.length,
                  amount: formatCurrency(total),
                })}
          </p>
        </div>
        <ChevronDown size={18} className={`text-ink-faint shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line">
          <InvoiceExpensesCard
            embedded
            invoiceId={invoiceId}
            expenses={expenses}
            invoiceTotal={invoiceTotal}
            categories={categories}
          />
        </div>
      )}
    </div>
  );
}
