import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QuotationForm from "@/components/QuotationForm";
import { withParsedMultipliersList } from "@/lib/multipliers";
import { withParsedFeesList } from "@/lib/fees";
import type { Quotation } from "@/types";
import { loadColleagueNames } from "@/lib/quotationAuthor";
import { getT } from "@/lib/i18n/server";
import { quotationVisible } from "@/lib/documentAccess";
import { readStaffDirectory, viewersFor } from "@/lib/staffDirectory";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params }: { params: { id: string } }) {
  const t = getT();
  if (!(await quotationVisible(params.id))) notFound();
  const [quotation, colleagueNames, directory] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { sortOrder: "asc" } }, shares: { orderBy: { sortOrder: "asc" } } },
    }),
    loadColleagueNames(),
    readStaffDirectory(),
  ]);

  if (!quotation) notFound();
  if (quotation.status === "CONVERTED") redirect(`/quotations/${quotation.id}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">
          {t("Edit {number}", { number: quotation.number })}
        </h1>
        <p className="text-sm text-ink-muted">{t("Changes recalculate totals automatically.")}</p>
      </div>
      <QuotationForm
        quotation={
          {
            ...quotation,
            items: withParsedFeesList(withParsedMultipliersList(quotation.items)),
            issueDate: quotation.issueDate.toISOString(),
            expiryDate: quotation.expiryDate?.toISOString() || null,
            createdAt: quotation.createdAt.toISOString(),
            updatedAt: quotation.updatedAt.toISOString(),
            shareMode: quotation.shareMode === "PERCENT" ? "PERCENT" : "AMOUNT",
            shares: quotation.shares.map((share) => ({
              colleagueName: share.colleagueName,
              value: share.value,
              sortOrder: share.sortOrder,
            })),
          } as Quotation
        }
        colleagueNames={colleagueNames}
        viewerEmails={viewersFor(directory, "quotation", quotation.id).join(", ")}
      />
    </div>
  );
}
