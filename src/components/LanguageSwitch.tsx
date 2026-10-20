"use client";

import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAppLanguage, useSetAppLanguage } from "@/lib/i18n/client";
import { htmlLang, LANGUAGE_COOKIE, type AppLanguage } from "@/lib/i18n/language";

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
];

/** Language choice lives in a cookie. It is not stored in the database. */
export default function LanguageSwitch({
  collapsed = false,
  menuDirection = "down",
  align = "right",
  className,
}: {
  collapsed?: boolean;
  menuDirection?: "up" | "down";
  align?: "left" | "right";
  className?: string;
}) {
  const router = useRouter();
  const language = useAppLanguage();
  const setLanguage = useSetAppLanguage();

  function choose(next: AppLanguage) {
    if (next === language) return;
    document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = htmlLang(next);
    setLanguage(next);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={clsx(
        "flex rounded-md border border-line bg-surface p-0.5",
        collapsed && "lg:flex-col",
        className
      )}
    >
      {OPTIONS.map((option) => {
        const selected = language === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => choose(option.value)}
            className={clsx(
              "flex-1 rounded px-2 py-1.5 text-xs transition-colors",
              selected ? "bg-paper font-semibold text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
