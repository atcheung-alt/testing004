"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { categoryLabel } from "@/lib/ensureExpenseCategories";
import { useT } from "@/lib/i18n/client";

export default function CategorySelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function text(name: string) {
    const label = categoryLabel(name);
    return label === "Others" ? t("Others") : t(label);
  }

  return (
    <div ref={root} className="relative">
      <button type="button" className="input flex items-center justify-between gap-2 text-left" onClick={() => setOpen((current) => !current)}>
        <span>{text(value)}</span>
        <ChevronDown size={16} className="shrink-0 text-ink-muted" />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full min-w-[12rem] card max-h-64 overflow-auto py-1">
          {options.map((name) => (
            <button
              key={name}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm ${name === value ? "bg-paper font-medium text-ink" : "text-ink hover:bg-paper"}`}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              {text(name)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
