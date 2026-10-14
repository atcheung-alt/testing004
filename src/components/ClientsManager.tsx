"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Loader2, AlertCircle, Search, Building2, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatCurrency } from "@/lib/calculations";
import ClickableTableRow from "@/components/ClickableTableRow";

export type ContactPerson = {
  id: string;
  name: string | null;
  email: string | null;
};

export type Customer = {
  id: string;
  name: string;
  address: string | null;
  contacts: ContactPerson[];
  quoteCount?: number;
  invoiceCount?: number;
  outstanding?: number;
  paid?: number;
};

function CustomerForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Customer;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [address, setAddress] = useState(initial?.address || "");
  // A brand-new company needs its first contact created in the same step —
  // a Customer can never exist with zero contacts.
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  // Contact name/email are both optional — leaving them blank shouldn't
  // block adding the client itself (see matching API-side comment).
  const canSave = name.trim().length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = initial ? `/api/customers/${initial.id}` : "/api/customers";
      const body = initial ? { name, address } : { name, address, contactName, contactEmail };
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not save this client."));
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">{t("Company name")}</label>
          <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("Company address")}</label>
          <input type="text" className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      {!initial && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-line">
          <p className="text-xs text-ink-muted sm:col-span-2 -mb-1">
            {t("Every company needs at least one contact person to start with.")}
          </p>
          <div>
            <label className="label">{t("Contact name (optional)")}</label>
            <input
              type="text"
              className="input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Contact email (optional)")}</label>
            <input
              type="email"
              className="input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving || !canSave} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {initial ? t("Save changes") : t("Add client")}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t("Cancel")}
        </button>
      </div>
    </div>
  );
}

export function ContactsPanel({
  customerId,
  contacts,
  onChanged,
}: {
  customerId: string;
  contacts: ContactPerson[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function addContact() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not add this contact."));
      setName("");
      setEmail("");
      setAdding(false);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(contactId: string) {
    setDeletingId(contactId);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/contacts/${contactId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove this contact."));
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-paper rounded-xl p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Contact persons")}</p>

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-xs rounded-lg px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {contacts.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 bg-surface rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserRound size={13} className="text-ink-faint shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{c.name || c.email || t("(no name or email)")}</p>
              {c.name && c.email && <p className="text-xs text-ink-faint truncate">{c.email}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeContact(c.id)}
            disabled={deletingId === c.id || contacts.length <= 1}
            title={contacts.length <= 1 ? t("A company needs at least one contact") : t("Remove contact")}
            aria-label={t("Remove {name}", { name: c.name || c.email || "" })}
            className="text-ink-faint hover:text-danger-500 transition-colors shrink-0 disabled:opacity-30 disabled:hover:text-ink-faint"
          >
            {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex flex-col gap-2 bg-surface rounded-lg p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              className="input"
              placeholder={t("Name (optional)")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              type="email"
              className="input"
              placeholder={t("Email (optional)")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addContact}
              disabled={saving}
              className="btn-primary !py-1.5 !text-xs"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {t("Save contact")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="btn-secondary !py-1.5 !text-xs"
            >
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn-ghost !px-2 text-xs self-start">
          <Plus size={13} /> {t("Add contact person")}
        </button>
      )}
    </div>
  );
}

export function ClientRecordEditor({ customer }: { customer: Customer }) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(customer);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();

  async function refresh() {
    const res = await fetch(`/api/customers/${customer.id}`);
    const data = await res.json();
    if (res.ok) setCurrent(data);
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove this client."));
      router.push("/clients");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {editing ? (
        <CustomerForm
          initial={current}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary">
            <Pencil size={15} /> {t("Edit")}
          </button>
          <button type="button" onClick={remove} disabled={deleting} className="btn-secondary text-danger-500">
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {t("Remove")}
          </button>
        </div>
      )}
      <ContactsPanel customerId={current.id} contacts={current.contacts} onChanged={refresh} />
    </div>
  );
}

export default function ClientsManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function load(q: string) {
    setLoading(true);
    fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((res) => res.json())
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function removeCustomer(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove this client."));
      load(query);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const outstanding = customers.reduce((sum, customer) => sum + (customer.outstanding || 0), 0);
  const paid = customers.reduce((sum, customer) => sum + (customer.paid || 0), 0);
  const quoteCount = customers.reduce((sum, customer) => sum + (customer.quoteCount || 0), 0);
  const editing = customers.find((customer) => customer.id === editingId);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("Clients")}</p>
          <p className="font-mono text-xl font-semibold text-ink mt-1">{loading ? "—" : customers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("Quotations")}</p>
          <p className="font-mono text-xl font-semibold text-ink mt-1">{loading ? "—" : quoteCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("Outstanding")}</p>
          <p className="font-mono text-xl font-semibold text-ink mt-1">{loading ? "—" : formatCurrency(outstanding)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("Paid")}</p>
          <p className="font-mono text-xl font-semibold text-ink mt-1">{loading ? "—" : formatCurrency(paid)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            className="input pl-9"
            placeholder={t("Search clients or contacts…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="button" onClick={() => setShowAddForm((v) => !v)} className="btn-primary shrink-0">
          <Plus size={15} /> {t("Add client")}
        </button>
      </div>

      {showAddForm && (
        <CustomerForm
          onCancel={() => setShowAddForm(false)}
          onSaved={() => {
            setShowAddForm(false);
            load(query);
          }}
        />
      )}

      {editing && (
        <CustomerForm
          initial={editing}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            load(query);
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">{t("Loading…")}</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {query ? t("No clients match your search.") : t("No clients saved yet — add your first one above.")}
        </p>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-paper text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("Clients")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Contact")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("Quotations")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("Invoices")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("Outstanding")}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t("Paid")}</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((c) => {
                  const contact = c.contacts[0];
                  return (
                    <ClickableTableRow key={c.id} href={`/clients/${c.id}`} className="hover:bg-paper">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center text-ink-faint shrink-0">
                            <Building2 size={14} />
                          </div>
                          <div className="min-w-0">
                            <Link href={`/clients/${c.id}`} className="text-sm font-medium text-ink hover:text-brand-500 truncate block">
                              {c.name}
                            </Link>
                            <p className="text-xs text-ink-faint truncate">{c.address || t("No address on file")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-ink truncate">{contact?.name || contact?.email || "—"}</p>
                        {contact?.name && contact.email && (
                          <p className="text-xs text-ink-faint truncate">{contact.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{c.quoteCount || 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{c.invoiceCount || 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(c.outstanding || 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(c.paid || 0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingId(c.id)}
                            aria-label={t("Edit {name}", { name: c.name })}
                            className="text-ink-faint hover:text-ink transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCustomer(c.id)}
                            disabled={deletingId === c.id}
                            aria-label={t("Remove {name}", { name: c.name })}
                            className="text-ink-faint hover:text-danger-500 transition-colors"
                          >
                            {deletingId === c.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </ClickableTableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
