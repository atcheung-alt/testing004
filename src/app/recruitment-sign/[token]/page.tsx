import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getPublicRecruitmentView } from "@/lib/publicRecruitment";
import RecruitmentSigningClient from "@/components/RecruitmentSigningClient";
import { COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const t = getT();
  const company = COMPANY.shortName || COMPANY.name;
  const view = await getPublicRecruitmentView(params.token);
  return {
    title: view
      ? t("Sign Agreement {number} — {company}", { number: view.number, company })
      : t("Signing link — {company}", { company }),
    // Signing links are shared privately by email/token and must never be
    // indexed or surfaced by search engines.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function SignRecruitmentAgreementPage({ params }: { params: { token: string } }) {
  const t = getT();
  const view = await getPublicRecruitmentView(params.token);

  if (!view) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-3">
        <ShieldAlert size={40} className="text-danger-500" />
        <h1 className="font-display text-xl font-semibold text-ink">
          {t("This Signing Link Isn't Valid")}
        </h1>
        <p className="text-sm text-ink-muted">
          {t(
            "It may have been mistyped, or the agreement it points to no longer exists. Please contact {contact} if you believe this is a mistake.",
            { contact: COMPANY.email || COMPANY.shortName || COMPANY.name }
          )}
        </p>
      </div>
    );
  }

  return <RecruitmentSigningClient token={params.token} initial={view} />;
}
