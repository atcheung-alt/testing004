"use client";

import { useLayoutEffect, useState } from "react";
import { formatCurrency } from "@/lib/calculations";

export default function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);

  useLayoutEffect(() => {
    const reduced =
      document.documentElement.dataset.animations === "off" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      return;
    }

    const start = performance.now();
    const duration = 900;
    let frame = 0;
    setShown(0);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{formatCurrency(shown)}</span>;
}
