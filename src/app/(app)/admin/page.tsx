import { redirect } from "next/navigation";
import AdminAccess from "@/components/AdminAccess";
import AdminCodeForm from "@/components/AdminCodeForm";
import { getAccount, isSuper } from "@/lib/access";
import { adminGateOpen } from "@/lib/adminGate";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const t = getT();
  const account = await getAccount();
  if (!account || !isSuper(account)) redirect("/");
  if (!(await adminGateOpen(account.id))) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Admin")}</h1>
          <p className="text-sm text-ink-muted">
            {t("Confirm accounts, choose what each person can open, and manage every company.")}
          </p>
        </div>
        <AdminCodeForm />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Admin")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Confirm accounts, choose what each person can open, and manage every company.")}
        </p>
      </div>
      <AdminAccess />
    </div>
  );
}
