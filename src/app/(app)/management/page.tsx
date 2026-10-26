import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/accessControl";
import ManagementWorkspace from "@/components/ManagementWorkspace";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) redirect("/");
  const t = getT();

  return (
    <div>
      <PageBar
        title={t("Management")}
        note={t("Open a row to use it. Each closed row says what it does.")}
      />
      <ManagementWorkspace />
    </div>
  );
}
