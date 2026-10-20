import SettingsForm from "@/components/SettingsForm";
import PageBar from "@/components/PageBar";
import ExpenseCategoriesManager from "@/components/ExpenseCategoriesManager";
import StaffAccountsManager from "@/components/StaffAccountsManager";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const t = getT();
  return (
    <div className="flex flex-col gap-4">
      <PageBar
        title={t("Settings")}
        note={t("Configure appearance, Google Drive sync, company branding, and email CC preferences.")}
      />
      {/* SettingsForm's "Save settings" button is the last thing inside it —
          kept last on the page on purpose so it always sits at the very
          bottom, below every other settings section. */}
      <StaffAccountsManager />
      <ExpenseCategoriesManager />
      <SettingsForm />
    </div>
  );
}
