"use client";

import { useEffect } from "react";

/**
 * Saves/restores this page's scroll position across a "back to list" round
 * trip (see BackButton.tsx), keyed by `restoreKey` (pass the page's own
 * path + query string, so different filters/searches each get their own
 * remembered position).
 *
 * Why this exists instead of just relying on the browser/Next.js: every
 * page here is `force-dynamic` and next.config.js deliberately sets
 * `experimental.staleTimes.dynamic: 0` so navigating anywhere always
 * re-fetches fresh data (so, e.g., marking an invoice Paid and hitting
 * Back doesn't show a stale Outstanding total). That's the right call for
 * data freshness, but it means Next replaces this page's DOM on every
 * back-navigation instead of reusing the snapshot the browser would
 * otherwise restore scroll onto — so what you'd see is the old scroll
 * position for an instant, then a snap back to the top once the fresh
 * render lands. Restoring it ourselves here sidesteps that entirely,
 * independent of Next's caching behavior.
 */
const INVOICE_LINKS = ["/invoices/"];

export default function ScrollRestorer({
  restoreKey,
  linkPrefixes = INVOICE_LINKS,
}: {
  restoreKey: string;
  linkPrefixes?: string[];
}) {
  const prefixKey = linkPrefixes.join("|");
  useEffect(() => {
    const storageKey = `scroll:${restoreKey}`;
    const saved = sessionStorage.getItem(storageKey);
    const y = saved ? Number(saved) : 0;
    const holding = !Number.isNaN(y) && y > 8;
    const holdUntil = holding ? performance.now() + 2000 : 0;
    if (holding) {
      // Next scrolls back to the top after the fresh list renders. Keep
      // putting the saved height back until that late jump has finished.
      const applyScroll = () => {
        if (performance.now() >= holdUntil) return;
        if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
        requestAnimationFrame(applyScroll);
      };
      requestAnimationFrame(applyScroll);
    }

    let locked = false;
    function save() {
      if (locked || performance.now() < holdUntil) return;
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
    // Save before Next scrolls the window to the top. A later scroll-to-top
    // must not replace the row position with 0.
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!linkPrefixes.some((prefix) => href.startsWith(prefix))) return;
      sessionStorage.setItem(storageKey, String(window.scrollY));
      sessionStorage.setItem("hrplus-return", JSON.stringify({
        list: `${window.location.pathname}${window.location.search}`,
        detail: href.split("?")[0],
      }));
      locked = true;
    }
    function onScroll() {
      if (holding && performance.now() < holdUntil) {
        if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
        return;
      }
      if (locked && window.scrollY < 8) return;
      locked = false;
      save();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [restoreKey, prefixKey]);

  return null;
}
