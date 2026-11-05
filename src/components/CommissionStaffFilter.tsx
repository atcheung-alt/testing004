"use client";

import { useEffect, useRef, useState } from "react";

export default function CommissionStaffFilter({
  value,
  allLabel,
  searchLabel,
  emptyLabel,
  people,
}: {
  value: string;
  allLabel: string;
  searchLabel: string;
  emptyLabel: string;
  people: { code: string; nickname: string; name: string }[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = people.find((person) => person.code === value);
  const shown = chosen ? chosen.nickname || chosen.name || chosen.code : allLabel;
  const needle = query.trim().toLowerCase();
  const options = people.filter((person) =>
    [person.nickname, person.name, person.code].join(" ").toLowerCase().includes(needle)
  );

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(code: string) {
    const form = root.current?.closest("form");
    const input = form?.querySelector<HTMLInputElement>("input[name=who]");
    if (input) input.value = code;
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <div className="relative" ref={root}>
      <input type="hidden" name="who" defaultValue={value} />
      <button
        type="button"
        className="rounded-full border border-line bg-surface px-3 py-2 text-left text-sm text-ink w-full"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen((current) => !current);
        }}
      >
        {shown}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <input
            className="input py-1.5"
            type="search"
            autoFocus
            placeholder={searchLabel}
            aria-label={searchLabel}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-1 max-h-56 overflow-auto">
            <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-paper" onClick={() => choose("")}>
              {allLabel}
            </button>
            {options.map((person) => {
              const title = person.nickname || person.name || person.code;
              const extra = person.name && person.name !== title ? person.name : "";
              return (
                <button
                  key={person.code}
                  type="button"
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-paper ${person.code === value ? "bg-paper" : ""}`}
                  onClick={() => choose(person.code)}
                >
                  {title}
                  {extra ? <span className="text-ink-muted"> · {extra}</span> : null}
                </button>
              );
            })}
            {options.length === 0 ? <p className="px-2 py-2 text-sm text-ink-muted">{emptyLabel}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
