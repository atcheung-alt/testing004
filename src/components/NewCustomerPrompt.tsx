"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Portal from "@/components/Portal";
import { useT } from "@/lib/i18n/client";

export type PromptCustomer = {
  customerName: string;
  customerContact: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
};

export default function NewCustomerPrompt({
  customer,
  onDone,
}: {
  customer: PromptCustomer;
  onDone: () => void;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);

  async function addToLibrary() {
    setSaving(true);
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customer.customerName,
          address: customer.customerAddress,
          contactName: customer.customerContact,
          contactEmail: customer.customerEmail,
        }),
      });
    } catch {
      // Best-effort — a failed library save shouldn't block navigating to
      // the quotation/invoice that was already successfully created.
    } finally {
      onDone();
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 animate-fade-in">
      <div className="card p-6 max-w-sm w-full flex flex-col gap-4 animate-scale-in">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t("Add to Client Library?")}</h2>
          <p className="text-sm text-ink-muted mt-1">
            {t(
              "{name} isn't in your client library yet — save them so future quotations/invoices are quicker to fill in?",
              { name: customer.customerName }
            )}
            {customer.customerContact && (
              <>
                {" "}
                {t("{name} will be saved as their first contact person.", {
                  name: customer.customerContact,
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addToLibrary}
            disabled={saving}
            className="btn-primary flex-1 justify-center"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {t("Add to library")}
          </button>
          <button type="button" onClick={onDone} className="btn-secondary flex-1 justify-center">
            {t("Skip")}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
