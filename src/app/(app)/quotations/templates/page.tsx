import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/EmptyState";
import DeleteButton from "@/components/DeleteButton";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function QuotationTemplatesPage() {
  const t = getT();
  const templates = await prisma.quotationTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    include: { items: { select: { name: true }, orderBy: { sortOrder: "asc" }, take: 5 } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Quotation templates")}</h1>
          <p className="text-sm text-ink-muted">
            {t("Save a format once. Next time, change the activity name, the items, and the dates.")}
          </p>
        </div>
        <Link href="/quotations/templates/new" className="btn-primary shrink-0">
          <Plus size={15} /> {t("New template")}
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={t("No templates yet")}
          description={t("Create one here, or open a quotation and choose Save as template.")}
          actionHref="/quotations/templates/new"
          actionLabel={t("New template")}
        />
      ) : (
        <div className="card divide-y divide-line">
          {templates.map((template) => (
            <div key={template.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{template.name}</p>
                <p className="text-xs text-ink-muted truncate mt-0.5">
                  {template.title || t("No activity name yet")}
                  {template.items.length > 0
                    ? ` · ${template.items.map((item) => item.name || t("Untitled item")).join(" · ")}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link href={`/quotations/new?template=${template.id}`} className="btn-primary">
                  {t("Use template")}
                </Link>
                <Link href={`/quotations/templates/${template.id}/edit`} className="btn-secondary">
                  {t("Edit")}
                </Link>
                <DeleteButton
                  url={`/api/quotation-templates/${template.id}`}
                  confirmNumber={template.name}
                  itemLabel="template"
                  redirectTo="/quotations/templates"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
