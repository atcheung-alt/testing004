import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/accessControl";
import ManagementWorkspace from "@/components/ManagementWorkspace";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) redirect("/");
  const t = getT();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Management")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Choose which pages each group can open. People who are not in a group keep full access.")}
        </p>
      </div>
      <ManagementWorkspace />
    </div>
  );
}
