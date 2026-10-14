import { redirect } from "next/navigation";
import { getAccount } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const t = getT();
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.status === "ACTIVE") redirect("/");
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="card p-6 max-w-md w-full flex flex-col gap-3">
        <h1 className="font-display text-xl font-semibold">{t("Waiting for confirmation")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Your account is signed in, but you cannot open any records until an admin confirms it. Log in again after it is confirmed.")}
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
