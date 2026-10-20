"use client";

import { useEffect, useState } from "react";
import { Search, X, Building2, UserRound, Library } from "lucide-react";
import Portal from "@/components/Portal";
import type { CustomerDetails } from "@/types";
import { useT } from "@/lib/i18n/client";

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

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-6 max-h-[85vh] flex flex-col animate-scale-in">
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

            <div className="flex-1 overflow-y-auto -mx-2 px-2 flex flex-col gap-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-ink-faint py-6 text-center">{t("No clients match “{search}”.", { search })}</p>
              ) : (
                filtered.map((c) => (
                  <div key={c.id} className="rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="w-full flex items-center gap-3 px-2 py-2 hover:bg-paper transition-colors text-left"
                    >
                      <Building2 size={16} className="text-ink-faint shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-ink-muted truncate">
                          {c.contacts.length === 1
                            ? t("{count} contact", { count: c.contacts.length })
                            : t("{count} contacts", { count: c.contacts.length })}
                        </p>
                      </div>
                    </button>
                    {expandedId === c.id && (
                      <div className="pl-8 pb-1 flex flex-col gap-0.5">
                        {c.contacts.map((contact) => (
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
                ))
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
  showContactAndPhone = true,
}: {
  value: CustomerDetails;
  onChange: (value: CustomerDetails) => void;
  /** Invoices still collect a contact person and phone; quotations don't. */
  showContactAndPhone?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
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
        {showContactAndPhone && (
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
        {showContactAndPhone && (
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

      {pickerOpen && <ClientPicker onPick={handlePick} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
