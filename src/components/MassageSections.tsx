"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useT } from "@/lib/i18n/client";

const TABS = ["events", "scores", "team"] as const;
type Tab = (typeof TABS)[number];

export default function MassageSections({
  events,
  scores,
  team,
}: {
  events: ReactNode;
  scores: ReactNode;
  team: ReactNode;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("events");
  const labels: Record<Tab, string> = {
    events: t("Events"),
    scores: t("Scores"),
    team: t("Team"),
  };
  const panel = tab === "events" ? events : tab === "scores" ? scores : team;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("Massage")}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-sm",
              tab === id ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-muted"
            )}
            onClick={() => setTab(id)}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      {panel}
    </div>
  );
}
