import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getPublicEmployeeLeaveView } from "@/lib/publicEmployeeLeave";
import EmployeeLeaveClient from "@/components/EmployeeLeaveClient";
import { COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const t = getT();
  const view = await getPublicEmployeeLeaveView(params.token);
  return {
    title: view
      ? t("Leave — {name}", { name: view.name })
      : t("Leave link — {company}", { company: COMPANY.shortName || COMPANY.name }),
    // Personal leave links are shared privately by token and must never be
    // indexed or surfaced by search engines.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function EmployeeLeavePage({ params }: { params: { token: string } }) {
  const t = getT();
  const view = await getPublicEmployeeLeaveView(params.token);

  if (!view) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-3">
        <ShieldAlert size={40} className="text-danger-500" />
        <h1 className="font-display text-xl font-semibold text-ink">{t("This Link Isn't Valid")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "It may have been mistyped, or the employee record it points to no longer exists. Please contact {contact} if you believe this is a mistake.",
            { contact: COMPANY.contact?.email || COMPANY.shortName || COMPANY.name }
          )}
        </p>
      </div>
    );
  }

  return <EmployeeLeaveClient token={params.token} initial={view} />;
}
