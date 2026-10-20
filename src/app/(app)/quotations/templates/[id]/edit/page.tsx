import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QuotationTemplateForm from "@/components/QuotationTemplateForm";
import { withParsedFeesList } from "@/lib/fees";
import { withParsedMultipliersList } from "@/lib/multipliers";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EditQuotationTemplatePage({ params }: { params: { id: string } }) {
  const t = getT();
  const raw = await prisma.quotationTemplate.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!raw) notFound();
  const items = withParsedFeesList(withParsedMultipliersList(raw.items));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Edit Template")}</h1>
        <p className="text-sm text-ink-muted">{raw.name}</p>
      </div>
      <QuotationTemplateForm
        template={{
          id: raw.id,
          name: raw.name,
          title: raw.title,
          notes: raw.notes,
          terms: raw.terms,
          reminder: raw.reminder,
          paymentDueDays: raw.paymentDueDays,
          language: raw.language,
          taxRate: raw.taxRate,
          discount: raw.discount,
          repeatCount: raw.repeatCount,
          items,
        }}
      />
    </div>
  );
}
