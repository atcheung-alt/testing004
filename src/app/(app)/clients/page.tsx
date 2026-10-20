import ClientsManager from "@/components/ClientsManager";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const t = getT();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Clients")}</h1>
        <p className="lead">
          {t(
            "Quotations and invoices for each client. Editing a client leaves saved documents unchanged."
          )}
        </p>
      </div>
      <ClientsManager />
    </div>
  );
}
