import InvoiceForm from "@/components/InvoiceForm";
import { customerFieldsForClient } from "@/lib/clientWork";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: { client?: string } }) {
  const t = getT();
  const client = searchParams.client ? await customerFieldsForClient(searchParams.client) : null;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("New invoice")}</h1>
        <p className="text-sm text-ink-muted">
          {client
            ? t("This invoice is for {name}.", { name: client.name })
            : t("Create an invoice directly, or convert an accepted quotation instead.")}
        </p>
      </div>
      <InvoiceForm customer={client || undefined} />
    </div>
  );
}
