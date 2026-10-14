import ClientsManager from "@/components/ClientsManager";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const t = getT();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Clients")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "Open a client to see their quotations and invoices. A document is linked when the company name or a contact email matches. Editing a client here does not change a document you already saved."
          )}
        </p>
      </div>
      <ClientsManager />
    </div>
  );
}
