"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Search } from "lucide-react";
import PayrollRunEntries from "@/components/PayrollRunEntries";
import { employeeNameMatches, getEmployeeDisplayName } from "@/lib/employeeName";
import { useT } from "@/lib/i18n/client";
import type { PayrollEntry } from "@/types";

type SearchValue = { q: string; setQ: (value: string) => void };
const SearchContext = createContext<SearchValue | null>(null);

type Group = { key: string; title: string; note: string };
type ListedEntry = PayrollEntry & { group: string };

export function PayrollRunSearch({ children }: { children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const value = useMemo(() => ({ q, setQ }), [q]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function PayrollRunSearchBox() {
  const t = useT();
  const search = useContext(SearchContext);
  if (!search) return null;
  return (
    <div className="relative w-full sm:w-72">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        className="input pl-9"
        value={search.q}
        placeholder={t("Search by name or nickname")}
        aria-label={t("Search by name or nickname")}
        onChange={(event) => search.setQ(event.target.value)}
      />
    </div>
  );
}

export function PayrollRunTables({
  entries,
  groups,
  runId,
  periodLabel,
  companyName,
}: {
  entries: ListedEntry[];
  groups: Group[];
  runId: string;
  periodLabel: string;
  companyName: string;
}) {
  const t = useT();
  const search = useContext(SearchContext);
  const q = search?.q || "";
  const shown = entries.filter((entry) =>
    employeeNameMatches(
      getEmployeeDisplayName({
        name: entry.employeeName,
        preferredName: entry.preferredName,
        nickname: entry.nickname,
        nameChinese: entry.nameChinese,
      }),
      q
    )
  );

  return (
    <>
      {q.trim() && shown.length === 0 ? <p className="text-sm text-ink-muted">{t("No matching people.")}</p> : null}
      {groups.map((group) => {
        const rows = shown.filter((entry) => entry.group === group.key);
        if (rows.length === 0) return null;
        return (
          <section key={group.key} className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">{group.title}</h2>
              <p className="text-sm text-ink-muted">{group.note}</p>
            </div>
            <PayrollRunEntries runId={runId} entries={rows} periodLabel={periodLabel} companyName={companyName} />
          </section>
        );
      })}
    </>
  );
}
