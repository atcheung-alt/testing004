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
        note={t(
          "Everyone is in one group. The Admin group can open every page. Other accounts start in Full access, and you can move them or change a group's pages later."
        )}
      />
      <ManagementWorkspace />
    </div>
  );
}
