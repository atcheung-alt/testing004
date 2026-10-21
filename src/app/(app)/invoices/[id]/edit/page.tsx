import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import InvoiceForm from "@/components/InvoiceForm";
import { withParsedMultipliersList } from "@/lib/multipliers";
import { withParsedFeesList } from "@/lib/fees";
import type { Invoice } from "@/types";
import { getT } from "@/lib/i18n/server";
import { getEventForInvoice } from "@/lib/events";
import { invoiceVisible } from "@/lib/documentAccess";
import { readStaffDirectory, viewersFor } from "@/lib/staffDirectory";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const t = getT();
  if (!(await invoiceVisible(params.id))) notFound();
  const [invoice, directory] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    readStaffDirectory(),
  ]);

  if (!invoice) notFound();
  const calendarEvent = await getEventForInvoice(invoice.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">
          {t("Edit {number}", { number: invoice.number })}
        </h1>
        <p className="text-sm text-ink-muted">{t("Changes recalculate totals automatically.")}</p>
      </div>
      <InvoiceForm
        invoice={
          {
            ...invoice,
            items: withParsedFeesList(withParsedMultipliersList(invoice.items)),
            issueDate: invoice.issueDate.toISOString(),
            dueDate: invoice.dueDate?.toISOString() || null,
            createdAt: invoice.createdAt.toISOString(),
            updatedAt: invoice.updatedAt.toISOString(),
          } as Invoice
        }
        calendarEventName={calendarEvent?.name || null}
        viewerEmails={viewersFor(directory, "invoice", invoice.id).join(", ")}
      />
    </div>
  );
}
