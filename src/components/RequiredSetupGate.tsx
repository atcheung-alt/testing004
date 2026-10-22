"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";
import Portal from "@/components/Portal";
import { useT } from "@/lib/i18n/client";

/**
 * Hard-blocks the app for the admin account until the handful of Settings
 * fields the rest of the app depends on (company branding, Drive folder,
 * CC address) have been filled in. Only ever shown to `isAdmin` users — see
 * `getMissingRequiredSettings()` in `src/lib/appSettings.ts` for the field
 * list, and `AppLayout` for where this is fed its data.
 *
 * Deliberately has no close/dismiss button and no backdrop-click handler —
 * this is a hard block, not a reminder. The one way out is the "Go to
 * Settings" link, which is why the gate excludes the /settings route itself
 * (otherwise the admin could never reach the form that fixes it).
 */
export default function RequiredSetupGate({
  isAdmin,
  missingFields,
}: {
  isAdmin: boolean;
  missingFields: string[];
}) {
  const t = useT();
  const pathname = usePathname();

  if (!isAdmin || missingFields.length === 0) return null;
  if (pathname === "/management") return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 animate-fade-in">
        <div className="card p-6 max-w-sm w-full flex flex-col gap-4 animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
              <Settings2 size={18} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">{t("Finish Setting Up HR Plus")}</h2>
              <p className="text-sm text-ink-muted mt-1">
                {t(
                  "A few company details need to be filled in on the Management page before the app can generate documents and emails correctly."
                )}
              </p>
            </div>
          </div>

          <ul className="text-sm text-ink flex flex-col gap-1">
            {missingFields.map((field) => (
              <li key={field} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0" />
                {t(field)}
              </li>
            ))}
          </ul>

          <Link href="/management" className="btn-primary justify-center">
            {t("Go to Management")}
          </Link>
        </div>
      </div>
    </Portal>
  );
}
