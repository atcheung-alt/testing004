import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import InvoiceForm from "@/components/InvoiceForm";
import QuotationShareEditor from "@/components/QuotationShareEditor";
import { withParsedMultipliersList } from "@/lib/multipliers";
import { withParsedFeesList } from "@/lib/fees";
import type { Invoice } from "@/types";
import { getT } from "@/lib/i18n/server";
import { getEventForInvoice } from "@/lib/events";
import { invoiceCanModify } from "@/lib/documentAccess";
import { loadColleagues, loadCreatorNickname } from "@/lib/quotationAuthor";
import { colleagueCode } from "@/lib/staffCode";
import { commissionSplitFromStored, isShareHolderNumber } from "@/lib/quotationShares";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const t = getT();
  if (!(await invoiceCanModify(params.id))) notFound();
  const [record, colleagues, invoiceCreator] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        quotation: {
          select: {
            id: true,
            number: true,
            preparedBy: true,
            shareMode: true,
            shares: { orderBy: { sortOrder: "asc" }, select: { colleagueName: true, value: true } },
          },
        },
      },
    }),
    loadColleagues(),
    loadCreatorNickname("invoice", params.id),
  ]);

  if (!record) notFound();
  const { quotation, ...invoice } = record;
  const [calendarEvent, quoteCreator] = await Promise.all([
    getEventForInvoice(invoice.id),
    quotation && !isShareHolderNumber(quotation.number)
      ? loadCreatorNickname("quotation", quotation.id)
      : Promise.resolve(""),
  ]);
  const creatorName = invoiceCreator || quoteCreator || quotation?.preparedBy || "";
  const split = commissionSplitFromStored(quotation?.shareMode || "AMOUNT", quotation?.shares || [], invoice.total);

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
      />
      <QuotationShareEditor
        invoiceId={invoice.id}
        canEdit
        creatorName={creatorName}
        commissionTotal={split.total}
        shares={split.partners.map((share) => ({
          colleagueName: colleagueCode(share.colleagueName, colleagues),
          value: share.percent,
        }))}
        colleagues={colleagues}
      />
    </div>
  );
}
