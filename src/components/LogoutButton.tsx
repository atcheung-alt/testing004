"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export default function LogoutButton() {
  const t = useT();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-secondary w-fit"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      {t("Log out")}
    </button>
  );
}
