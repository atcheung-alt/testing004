import QuotationForm, { type QuotationFormPreset } from "@/components/QuotationForm";
import { prisma } from "@/lib/prisma";
import { withParsedFeesList } from "@/lib/fees";
import { withParsedMultipliersList } from "@/lib/multipliers";
import { customerFieldsForClient } from "@/lib/clientWork";
import { loadColleagues, loadCurrentNickname } from "@/lib/quotationAuthor";
import { templateVisible } from "@/lib/documentAccess";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: { template?: string; client?: string };
}) {
  const t = getT();
  const client = searchParams.client ? await customerFieldsForClient(searchParams.client) : null;
  const [defaultPreparedBy, colleagues] = await Promise.all([loadCurrentNickname(), loadColleagues()]);
  let preset: QuotationFormPreset | undefined;
  if (searchParams.template && (await templateVisible(searchParams.template))) {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id: searchParams.template },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (template) {
      preset = {
        templateName: template.name,
        title: template.title,
        notes: template.notes,
        terms: template.terms,
        reminder: template.reminder,
        paymentDueDays: template.paymentDueDays,
        language: template.language,
        taxRate: template.taxRate,
        discount: template.discount,
        repeatCount: template.repeatCount,
        items: withParsedFeesList(withParsedMultipliersList(template.items)),
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("New Quotation")}</h1>
        <p className="text-sm text-ink-muted">
          {client
            ? t("This quotation is for {name}. Add the activity and line items.", { name: client.name })
            : preset
              ? t("This quotation started from “{name}”. Update the activity name, items, and dates before you save.", {
                  name: preset.templateName,
                })
              : t("Enter the customer details, add line items, and HR Plus will calculate totals automatically.")}
        </p>
      </div>
      <QuotationForm
        preset={preset}
        customer={client || undefined}
        defaultPreparedBy={defaultPreparedBy}
        colleagues={colleagues}
      />
    </div>
  );
}
