import ClientsManager from "@/components/ClientsManager";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const t = getT();
  return (
    <div>
      <PageBar
        title={t("Clients")}
        note={t("Quotations and invoices for each client. Editing a client leaves saved documents unchanged.")}
      />
      <ClientsManager />
    </div>
  );
}
