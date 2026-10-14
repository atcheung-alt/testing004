import { redirect } from "next/navigation";
import CompanyAccess from "@/components/CompanyAccess";
import { getAccount, isCompanyAdmin } from "@/lib/access";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const t = getT();
  const account = await getAccount();
  if (!account || !isCompanyAdmin(account)) redirect("/");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Company")}</h1>
        <p className="text-sm text-ink-muted">{t("Confirm your colleagues and choose what they can open.")}</p>
      </div>
      <CompanyAccess />
    </div>
  );
}
