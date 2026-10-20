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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-ink">{t("Quotation templates")}</h1>
          <p className="lead">
            {t("Reuse a saved quotation. Update the activity, items, and dates each time.")}
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
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Template name")}</th>
                <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Activity name")}</th>
                <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Items")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3 font-sans font-medium text-ink">{template.name}</td>
                  <td className="px-4 py-3 font-sans text-ink-muted">{template.title || t("No activity name yet")}</td>
                  <td className="px-4 py-3 font-sans text-ink-muted">
                    {template.items.length > 0
                      ? template.items.map((item) => item.name || t("Untitled item")).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
