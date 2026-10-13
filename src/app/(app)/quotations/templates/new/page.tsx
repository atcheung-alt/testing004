import QuotationTemplateForm from "@/components/QuotationTemplateForm";
import { getT } from "@/lib/i18n/server";

export default function NewQuotationTemplatePage() {
  const t = getT();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("New template")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Set the format you reuse: activity name, line items, and the standard wording. Dates are chosen each time you use it.")}
        </p>
      </div>
      <QuotationTemplateForm />
    </div>
  );
}
