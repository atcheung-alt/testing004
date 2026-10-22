import SettingsForm from "@/components/SettingsForm";
import PageBar from "@/components/PageBar";
import MyNicknameForm from "@/components/MyNicknameForm";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const t = getT();
  return (
    <div className="flex flex-col gap-4">
      <PageBar title={t("Settings")} note={t("Appearance, and the nickname you set for yourself.")} />
      <MyNicknameForm />
      <SettingsForm part="appearance" />
    </div>
  );
}
