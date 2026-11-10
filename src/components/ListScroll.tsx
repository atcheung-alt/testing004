"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Remembers window scroll for the current list. A click that opens a detail
 * page is saved before Next scrolls back to the top, and the list restores
 * that position when the user comes back.
 */
export default function ListScroll() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = `${pathname}${search ? `?${search}` : ""}`;

  useEffect(() => {
    const storageKey = `scroll:${key}`;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const y = Number(saved);
      if (!Number.isNaN(y)) {
        let attempts = 0;
        const apply = () => {
          window.scrollTo(0, y);
          attempts += 1;
          if (attempts < 12) requestAnimationFrame(apply);
        };
        requestAnimationFrame(apply);
      }
    }

    let locked = false;
    function save() {
      if (locked) return;
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("a, button, [role='button'], tr")) return;
      sessionStorage.setItem(storageKey, String(window.scrollY));
      locked = true;
      window.setTimeout(() => {
        locked = false;
      }, 800);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", save);
    };
  }, [key]);

  return null;
}
