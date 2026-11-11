"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Real browser back navigation, not a plain `<Link href={fallbackHref}>` —
 * the list pages this leaves from (invoices, quotations) keep their search/
 * status/date filters and scroll position entirely in the URL and browser
 * history, so `router.back()` lands exactly back where the user was
 * (same query string, same scroll offset) instead of reloading a fresh,
 * filterless list from the top. Falls back to `fallbackHref` only when
 * there's no in-app history to go back to (e.g. the page was opened
 * directly via a bookmark or new tab).
 */
export default function BackButton({
  fallbackHref,
  label,
  listRoute,
}: {
  fallbackHref: string;
  label: string;
  listRoute?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        const route = listRoute || "";
        let fromList = false;
        if (route) {
          try {
            const saved = JSON.parse(sessionStorage.getItem("hrplus-return") || "null") as { list?: string; detail?: string } | null;
            const list = saved?.list || "";
            const detail = saved?.detail || "";
            fromList = Boolean(
              detail &&
                window.location.pathname.startsWith(detail) &&
                (list === route || list.startsWith(`${route}?`))
            );
          } catch {
            fromList = false;
          }
        }
        if (fromList && window.history.length > 1) {
          router.back();
          return;
        }
        if (!route && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className="text-sm text-ink-muted hover:text-ink flex items-center gap-1 w-fit"
    >
      <ArrowLeft size={14} /> {label}
    </button>
  );
}
