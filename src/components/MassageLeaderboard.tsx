import clsx from "clsx";
import { Medal } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { TherapistStanding } from "@/lib/massage";

function Meter({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
        <span>{label}</span>
        <span className="font-mono">{active ? value.toFixed(1) : "—"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden">
        <div
          className={clsx("h-full rounded-full", !active ? "bg-transparent" : value < 4 ? "bg-danger-500" : "bg-brand-600")}
          style={{ width: active ? `${(value / 5) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function ScoreBlock({ row }: { row: TherapistStanding }) {
  const t = getT();
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meter label={t("Overall")} value={row.overall} active={row.count > 0} />
      <Meter label={t("Care")} value={row.focus} active={row.count > 0} />
      <Meter label={t("Pressure")} value={row.pressure} active={row.count > 0} />
      <Meter label={t("Relief")} value={row.relief} active={row.count > 0} />
    </div>
  );
}

function PodiumCard({ row, rank }: { row: TherapistStanding; rank: number }) {
  const t = getT();
  return (
    <article
      className={clsx(
        "card p-4 sm:p-5",
        rank === 1 && "order-1 sm:order-2 border-accent-500/70",
        rank === 2 && "order-2 sm:order-1",
        rank === 3 && "order-3"
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 font-display text-lg font-semibold",
            rank === 1 ? "text-accent-600" : "text-ink-muted"
          )}
        >
          <Medal size={18} />
          {rank}
        </span>
        {row.early && <span className="stamp border-line text-ink-muted">{t("Early")}</span>}
      </div>
      <h3 className="font-display text-xl font-semibold leading-tight">{row.name}</h3>
      <p className="mt-2 font-mono text-3xl font-medium tracking-tight text-brand-700">
        {row.score.toFixed(1)}
        <span className="text-base text-ink-faint"> / 5</span>
      </p>
      <p className="text-xs text-ink-muted mt-1 mb-4">{t("{count} surveys", { count: row.count })}</p>
      <ScoreBlock row={row} />
    </article>
  );
}

export default function MassageLeaderboard({ rows }: { rows: TherapistStanding[] }) {
  const t = getT();
  const ranked = rows.filter((row) => row.count > 0);
  const waiting = rows.filter((row) => row.count === 0);
  const podium = ranked.slice(0, 3);

  if (ranked.length === 0) {
    return (
      <div className="card flex flex-col items-center text-center py-14 px-6">
        <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
          <Medal size={22} />
        </div>
        <h3 className="font-display text-lg font-semibold mb-1">{t("No guest scores yet")}</h3>
        <p className="text-sm text-ink-muted max-w-sm">{t("After guests scan an event QR code, the ranking shows up here.")}</p>
        {waiting.length > 0 && (
          <p className="text-xs text-ink-faint mt-4">{waiting.map((row) => row.name).join(" · ")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3 sm:items-stretch">
        {podium.map((row, index) => (
          <PodiumCard key={row.id} row={row} rank={index + 1} />
        ))}
      </div>

      <div className="card divide-y divide-line">
        <div className="px-4 sm:px-5 py-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("League table")}</h3>
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">{t("Score")} / 5</p>
        </div>
        {ranked.map((row, index) => (
          <div key={row.id} className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3 lg:w-64 shrink-0 min-w-0">
              <span className="font-mono text-sm text-ink-faint w-6">{index + 1}</span>
              <div className="min-w-0">
                <p className="font-medium truncate">{row.name}</p>
                <p className="text-xs text-ink-muted">
                  {t("{count} surveys", { count: row.count })}
                  {row.early ? ` · ${t("Early")}` : ""}
                </p>
              </div>
            </div>
            <p className="font-mono text-2xl font-medium text-brand-700 lg:w-24 shrink-0">
              {row.score.toFixed(1)}
            </p>
            <div className="flex-1 min-w-0">
              <ScoreBlock row={row} />
            </div>
          </div>
        ))}
        {waiting.length > 0 && (
          <div className="px-4 sm:px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">
              {t("Waiting for a first score")}
            </p>
            <p className="text-sm text-ink-muted">{waiting.map((row) => row.name).join(" · ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
