import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import StatCard from "@/components/StatCard";
import PresetItemsManager from "@/components/PresetItemsManager";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ItemLibraryPage() {
  const t = getT();
  const presetItemCount = await prisma.presetItem.count();

  return (
    <div className="flex flex-col gap-4">
      <PageBar
        title={t("Item Library")}
        note={t("Manage your standardized items. Anything saved here can be picked from a dropdown when building a quotation or invoice.")}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={t("Preset items")} value={String(presetItemCount)} icon={Package} />
      </div>
      <PresetItemsManager />
    </div>
  );
}
