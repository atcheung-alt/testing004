import SettingsForm from "@/components/SettingsForm";
import ExpenseCategoriesManager from "@/components/ExpenseCategoriesManager";
import StaffAccountsManager from "@/components/StaffAccountsManager";
import { getAccount, isCompanyAdmin, isSuper } from "@/lib/access";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = getT();
  const account = await getAccount();
  const companyOnly = !!account && isCompanyAdmin(account) && !isSuper(account);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Settings")}</h1>
        <p className="text-sm text-ink-muted">
          {companyOnly
            ? t("Confirm and edit accounts in your company.")
            : t("Configure appearance, Google Drive sync, company branding, and email CC preferences.")}
        </p>
      </div>
      {(isSuper(account || { role: "", isAdmin: false }) || companyOnly) && <StaffAccountsManager />}
      {!companyOnly && (
        <>
          <ExpenseCategoriesManager />
          <SettingsForm />
        </>
      )}
    </div>
  );
}
