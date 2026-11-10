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
export default function ScrollRestorer({ restoreKey }: { restoreKey: string }) {
  useEffect(() => {
    const storageKey = `scroll:${restoreKey}`;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const y = Number(saved);
      if (!Number.isNaN(y)) {
        // The real list streams in via <Suspense> and may not have replaced
        // the "Loading…" fallback yet on the first frame after mount, so a
        // single scrollTo can land before there's anything to scroll to —
        // keep re-applying it across a few frames until the content (and
        // the page's full height) has actually settled.
        let attempts = 0;
        const applyScroll = () => {
          window.scrollTo(0, y);
          attempts += 1;
          if (attempts < 10) requestAnimationFrame(applyScroll);
        };
        requestAnimationFrame(applyScroll);
      }
    }

    let locked = false;
    function save() {
      if (locked) return;
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
      if (!href.startsWith("/invoices/")) return;
      sessionStorage.setItem(storageKey, String(window.scrollY));
      locked = true;
    }
    function onScroll() {
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
  }, [restoreKey]);

  return null;
}
