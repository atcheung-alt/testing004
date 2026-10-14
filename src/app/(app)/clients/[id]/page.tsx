import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ReceiptText, AlertTriangle, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus } from "@/lib/invoiceStatus";
import { documentMatchesClient, loadAllDocuments, summarizeClient } from "@/lib/clientWork";
import { ClientRecordEditor } from "@/components/ClientsManager";
import BackButton from "@/components/BackButton";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const t = getT();
  const [customer, allDocuments] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: params.id },
      include: { contacts: { orderBy: { createdAt: "asc" } } },
    }),
    loadAllDocuments(),
  ]);
  if (!customer) notFound();

  const documents = {
    quotations: allDocuments.quotations.filter((quote) => documentMatchesClient(quote, customer)),
    invoices: allDocuments.invoices.filter((invoice) => documentMatchesClient(invoice, customer)),
  };
  const money = summarizeClient(customer, documents.quotations, documents.invoices);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackButton fallbackHref="/clients" label={t("Clients")} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mt-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{customer.name}</h1>
            <p className="text-sm text-ink-muted mt-1">
              {customer.address || t("No address on file")}
              {" · "}
              {t("Linked by company name or contact email.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/quotations/new?client=${customer.id}`} className="btn-secondary">
              <FileText size={15} /> {t("New quotation")}
            </Link>
            <Link href={`/invoices/new?client=${customer.id}`} className="btn-primary">
              <ReceiptText size={15} /> {t("New invoice")}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={t("Quotations")}
          value={String(money.quoteCount)}
          icon={FileText}
        />
        <StatCard
          label={t("Invoices")}
          value={String(money.invoiceCount)}
          icon={ReceiptText}
        />
        <StatCard
          label={t("Outstanding")}
          value={formatCurrency(money.outstanding)}
          icon={AlertTriangle}
          accent="accent"
        />
        <StatCard label={t("Paid")} value={formatCurrency(money.paid)} icon={TrendingUp} accent="accent" />
      </div>

      <ClientRecordEditor
        customer={{
          id: customer.id,
          name: customer.name,
          address: customer.address,
          contacts: customer.contacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            email: contact.email,
          })),
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("Quotations")}</h2>
        {documents.quotations.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No quotations for this client yet.")}</p>
        ) : (
          <div className="card divide-y divide-line">
            {documents.quotations.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotations/${quote.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-paper transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{quote.number}</span>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p className="text-xs text-ink-muted truncate mt-0.5">
                    {quote.title || quote.customerName} · {formatDate(quote.issueDate)}
                  </p>
                </div>
                <p className="font-mono text-sm">{formatCurrency(quote.total)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("Invoices")}</h2>
        {documents.invoices.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No invoices for this client yet.")}</p>
        ) : (
          <div className="card divide-y divide-line">
            {documents.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-paper transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{invoice.number}</span>
                    <StatusBadge status={getInvoiceDisplayStatus(invoice)} />
                  </div>
                  <p className="text-xs text-ink-muted truncate mt-0.5">
                    {invoice.title || invoice.customerName} · {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <p className="font-mono text-sm">{formatCurrency(invoice.total)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
