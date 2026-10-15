"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * Keeps a list page's title, search, filters, and top-right actions
 * pinned while the document list scrolls. Negative margins cancel the
 * app layout's padding so the bar sits flush with the viewport. The
 * frosted backdrop only appears after the page has been scrolled, so
 * the top of the page still looks like the rest of the layout.
 */
export default function StickyListHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function update() {
      setScrolled(window.scrollY > 0);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      className={clsx(
        "sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 -mt-16 lg:-mt-8 px-4 sm:px-6 lg:px-10 pt-14 lg:pt-4 pb-8 lg:pb-10 transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled ? "bg-paper/90 backdrop-blur-md border-b border-line" : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
