"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Languages } from "lucide-react";
import clsx from "clsx";
import { useAppLanguage, useSetAppLanguage } from "@/lib/i18n/client";
import { htmlLang, LANGUAGE_COOKIE, type AppLanguage } from "@/lib/i18n/language";

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: AppLanguage) {
    setOpen(false);
    if (next === language) return;
    document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = htmlLang(next);
    setLanguage(next);
    router.refresh();
  }

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        title="Language"
        className={clsx(
          "btn-secondary w-full",
          collapsed && "lg:justify-center lg:px-0 lg:w-10"
        )}
      >
        <Languages size={15} />
        <span className={clsx("inline-flex items-center gap-1", collapsed && "lg:hidden")}>
          Language
          <ChevronDown size={14} className={clsx("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Language"
          className={clsx(
            "absolute z-50 min-w-[9.5rem] card p-1 shadow-card",
            menuDirection === "up" ? "bottom-full mb-1" : "top-full mt-1",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={language === option.value}
              onClick={() => choose(option.value)}
              className={clsx(
                "flex w-full items-center rounded-lg px-3 py-2 text-sm text-left transition-colors",
                language === option.value
                  ? "bg-brand-50 text-brand-600 font-medium"
                  : "text-ink hover:bg-paper"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
