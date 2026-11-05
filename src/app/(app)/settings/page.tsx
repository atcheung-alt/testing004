import SettingsForm from "@/components/SettingsForm";
import PageBar from "@/components/PageBar";
import MyNicknameForm from "@/components/MyNicknameForm";
import LanguageSwitch from "@/components/LanguageSwitch";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = getT();
  const session = await getCurrentUser();
  const admin = Boolean(session && (session.isAdmin || isSuperAdmin(session)));
  return (
    <div className="flex flex-col gap-4">
      <PageBar title={t("Settings")} note={t("Appearance, and the nickname you set for yourself.")} />
      <MyNicknameForm />
      <div className="card p-5 flex flex-col gap-3 max-w-2xl">
        <h2 className="font-display text-lg font-semibold">{t("Language")}</h2>
        <LanguageSwitch className="max-w-[8rem]" />
      </div>
      <SettingsForm part="appearance" admin={admin} />
    </div>
  );
}
