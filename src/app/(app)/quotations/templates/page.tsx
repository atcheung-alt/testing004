import { prisma } from "@/lib/prisma";
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

  const drafted: (TemplateRow & { createdAt: Date })[] = [
    ...quotations.map((template) => ({
      id: template.id,
      kind: "quotation" as const,
      name: template.name,
      detail: [template.title, template.items.map((item) => item.name).filter(Boolean).join(", ")].filter(Boolean).join(" · "),
      code: "",
      createdAt: template.createdAt,
    })),
    ...recruitment.map((template) => ({
      id: template.id,
      kind: "recruitment" as const,
      name: template.name,
      detail: [template.companyName || template.role, template.requirements].filter(Boolean).join(" · "),
      code: "",
      createdAt: template.createdAt,
    })),
  ];
  const counts = new Map<number, number>();
  const rows: TemplateRow[] = [...drafted]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map((row) => {
      const year = row.createdAt.getFullYear();
      const next = (counts.get(year) || 0) + 1;
      counts.set(year, next);
      return { ...row, code: `TP-${year}-${String(next).padStart(4, "0")}` };
    });

  return <TemplateLibrary rows={rows} title={t("Templates")} note={t("Manage and reuse saved quotation and recruitment templates.")} />;
}
