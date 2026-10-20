import FeeScaleManager from "@/components/FeeScaleManager";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function FeeScalePage() {
  const t = getT();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Fee Scale Library")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "Manage the standard rates that pre-fill Clause 13.b's two fee scale tables on a new agreement — add, edit, or delete rows the same way you manage the item library. Each agreement gets its own editable copy from there, so this only sets the starting point."
          )}
        </p>
      </div>
      <FeeScaleManager />
    </div>
  );
}
