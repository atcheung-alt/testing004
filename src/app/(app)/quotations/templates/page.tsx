import { prisma } from "@/lib/prisma";
import PageBar from "@/components/PageBar";
import TemplateLibrary, { type TemplateRow } from "@/components/TemplateLibrary";
import { getT } from "@/lib/i18n/server";
import { andFilters, currentTemplateFilter } from "@/lib/documentAccess";
import { listRecruitmentTemplates } from "@/lib/recruitmentTemplate";

export const dynamic = "force-dynamic";

export default async function QuotationTemplatesPage() {
  const t = getT();
  const [quotations, recruitment] = await Promise.all([
    prisma.quotationTemplate.findMany({
      where: andFilters({}, await currentTemplateFilter()),
      orderBy: { updatedAt: "desc" },
      include: { items: { select: { name: true }, orderBy: { sortOrder: "asc" }, take: 5 } },
    }),
    listRecruitmentTemplates(),
  ]);

  const rows: TemplateRow[] = [
    ...quotations.map((template) => ({
      id: template.id,
      kind: "quotation" as const,
      name: template.name,
      detail: [template.title, template.items.map((item) => item.name).filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    })),
    ...recruitment.map((template) => ({
      id: template.id,
      kind: "recruitment" as const,
      name: template.name,
      detail: [template.role, template.requirements].filter(Boolean).join(" · "),
    })),
  ];

  return (
    <div>
      <PageBar
        title={t("Templates")}
        note={t("Manage and reuse saved quotation and recruitment templates.")}
      />
      <TemplateLibrary rows={rows} />
    </div>
  );
}
