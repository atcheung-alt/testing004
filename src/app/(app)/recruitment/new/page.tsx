import RecruitmentAgreementForm from "@/components/RecruitmentAgreementForm";
import { getRecruitmentTemplate } from "@/lib/recruitmentTemplate";
import { getT } from "@/lib/i18n/server";
import type { RecruitmentLanguage } from "@/lib/recruitmentTerms";

export const dynamic = "force-dynamic";

export default async function NewRecruitmentAgreementPage({
  searchParams,
}: {
  searchParams: { template?: string };
}) {
  const t = getT();
  const saved = searchParams.template ? await getRecruitmentTemplate(searchParams.template) : null;
  const language: RecruitmentLanguage =
    saved?.language === "ZH_HANT" || saved?.language === "ZH_HANS" ? saved.language : "EN";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("New Recruitment Agreement")}</h1>
        <p className="text-sm text-ink-muted">
          {saved
            ? t("This agreement started from “{name}”. Update the client details before you save.", { name: saved.name })
            : t(
                "Enter the client's company name, email, and payment terms — the terms of business below update automatically to match."
              )}
        </p>
      </div>
      <RecruitmentAgreementForm
        preset={saved ? {
          name: saved.name,
          role: saved.role,
          requirements: saved.requirements,
          paymentDueDays: saved.paymentDueDays || 14,
          language,
          terms: saved.terms,
          feeScalePermanent: saved.feeScalePermanent || [],
          feeScaleContract: saved.feeScaleContract || [],
        } : undefined}
      />
    </div>
  );
}
