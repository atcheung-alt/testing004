"use client";

import { useEffect, useState } from "react";
import { Search, X, Building2, UserRound, Library } from "lucide-react";
import Portal from "@/components/Portal";
import type { CustomerDetails } from "@/types";
import { useT } from "@/lib/i18n/client";
import { saveClientToLibrary } from "@/lib/saveClient";

export function emptyCustomer(): CustomerDetails {
  return {
    customerName: "",
    customerContact: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
  };
}

type LibraryContact = { id: string; name: string | null; email: string | null };
type LibraryCustomer = { id: string; name: string; address: string | null; contacts: LibraryContact[] };

function ClientPicker({
  onPick,
  onClose,
}: {
  onPick: (customer: LibraryCustomer, contact: LibraryContact) => void;
  onClose: () => void;
}) {
  const [customers, setCustomers] = useState<LibraryCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter((c) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    const contacts = Array.isArray(c.contacts) ? c.contacts : [];
    return [c.name, ...contacts.flatMap((contact) => [contact.name, contact.email])]
      .filter(Boolean)
      .some((part) => String(part).toLowerCase().includes(needle));
  });

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden card p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">{t("Choose from Client Library")}</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label={t("Close")}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-ink-muted">{t("Loading…")}</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {t("No clients saved yet. Add one from the")}{" "}
            <a href="/clients" target="_blank" className="text-brand-500 hover:underline">
              {t("Clients")}
            </a>{" "}
            {t("page to pick them from here.")}
          </p>
        ) : (
          <>
            <div className="relative mb-3 shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                className="input pl-9"
                placeholder={t("Search client library…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 -mx-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-ink-faint py-6 text-center">{t("No clients match “{search}”.", { search })}</p>
              ) : (
                filtered.map((c) => {
                  const contacts = Array.isArray(c.contacts) ? c.contacts : [];
                  return (
                  <div key={c.id} className="rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        if (contacts.length <= 1) {
                          onPick(c, contacts[0] || { id: c.id, name: "", email: "" });
                          return;
                        }
                        setExpandedId(expandedId === c.id ? null : c.id);
                      }}
                      className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-paper"
                    >
                      <Building2 size={16} className="text-ink-faint shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {contacts.length === 1
                            ? contacts[0].name || contacts[0].email || t("{count} Contact", { count: 1 })
                            : t("{count} Contacts", { count: contacts.length })}
                        </p>
                      </div>
                    </button>
                    {expandedId === c.id && contacts.length > 1 && (
                      <div className="flex flex-col gap-0.5 pb-1 pl-8">
                        {contacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => onPick(c, contact)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-50 transition-colors text-left"
                          >
                            <UserRound size={13} className="text-ink-faint shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm truncate">
                                {contact.name || contact.email || t("(no name or email)")}
                              </p>
                              {contact.name && contact.email && (
                                <p className="text-xs text-ink-faint truncate">{contact.email}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}

export default function CustomerFields({
  value,
  onChange,
  showContact = true,
  showPhone = true,
}: {
  value: CustomerDetails;
  onChange: (value: CustomerDetails) => void;
  showContact?: boolean;
  showPhone?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientNote, setClientNote] = useState("");
  const [clientError, setClientError] = useState("");
  const t = useT();

  function set(patch: Partial<CustomerDetails>) {
    onChange({ ...value, ...patch });
  }

  function handlePick(customer: LibraryCustomer, contact: LibraryContact) {
    set({
      customerName: customer.name,
      customerContact: contact.name || "",
      customerEmail: contact.email,
      customerAddress: customer.address || "",
    });
    setPickerOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="btn-secondary self-start"
      >
        <Library size={15} /> {t("Choose from Client Library")}
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">{t("Company name *")}</label>
          <input
            type="text"
            className="input"
            placeholder={t("e.g. TechVision Limited")}
            value={value.customerName}
            onChange={(e) => set({ customerName: e.target.value })}
          />
        </div>
        {showContact && (
          <div>
            <label className="label">{t("Contact person")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("e.g. Sarah Chen")}
              value={value.customerContact || ""}
              onChange={(e) => set({ customerContact: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className="label">{t("Email")}</label>
          <input
            type="email"
            className="input"
            placeholder={t("accounts@example.com")}
            value={value.customerEmail || ""}
            onChange={(e) => set({ customerEmail: e.target.value })}
          />
        </div>
        {showPhone && (
          <div>
            <label className="label">{t("Phone")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("+1 (555) 000-0000")}
              value={value.customerPhone || ""}
              onChange={(e) => set({ customerPhone: e.target.value })}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">{t("Address")}</label>
          <textarea
            className="input min-h-[80px]"
            placeholder={t("Street, city, state/province, postal code, country")}
            value={value.customerAddress || ""}
            onChange={(e) => set({ customerAddress: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={savingClient || !(value.customerName || "").trim()}
          onClick={async () => {
            setSavingClient(true);
            setClientError("");
            setClientNote("");
            try {
              const result = await saveClientToLibrary({
                company: value.customerName,
                contactName: value.customerContact || "",
                email: value.customerEmail || "",
                address: value.customerAddress || "",
              });
              setClientNote(result === "exists" ? t("This client is already on the Clients page.") : t("Saved. Clients now lists this company and person."));
            } catch (err: any) {
              setClientError(t(err.message));
            } finally {
              setSavingClient(false);
            }
          }}
        >
          {savingClient ? t("Saving…") : t("Save client")}
        </button>
        {clientNote ? <p className="text-sm text-emerald-600">{clientNote}</p> : null}
        {clientError ? <p className="text-sm text-danger-500">{clientError}</p> : null}
      </div>

      {pickerOpen && <ClientPicker onPick={handlePick} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
