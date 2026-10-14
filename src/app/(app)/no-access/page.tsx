import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  const t = getT();
  return (
    <div className="card p-6 max-w-lg">
      <h1 className="font-display text-xl font-semibold mb-1">{t("No access yet")}</h1>
      <p className="text-sm text-ink-muted">
        {t("An admin has confirmed your account, but has not chosen which parts of the site you can open.")}
      </p>
    </div>
  );
}
