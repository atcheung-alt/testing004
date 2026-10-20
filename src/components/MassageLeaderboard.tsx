import { Trophy } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { adjustedScore, type TherapistStanding } from "@/lib/massage";
import MassageScoreLookup, { type ScoreNote } from "@/components/MassageScoreLookup";

const SAMPLE_ROWS: TherapistStanding[] = [
  { id: "sample-100", name: "示範 · 何大文", count: 100, score: 4.8, overall: 4.8, focus: 4.8, pressure: 4.7, relief: 4.9, early: false },
  { id: "sample-14", name: "示範 · 林可怡", count: 14, score: 4.8, overall: 4.9, focus: 4.8, pressure: 4.6, relief: 4.9, early: false },
  { id: "sample-11", name: "示範 · 陳俊傑", count: 11, score: 4.6, overall: 4.7, focus: 4.5, pressure: 4.6, relief: 4.6, early: false },
  { id: "sample-1", name: "示範 · 周小美", count: 1, score: 5.0, overall: 5, focus: 5, pressure: 5, relief: 5, early: true },
  { id: "sample-3", name: "示範 · 張啟賢", count: 3, score: 4.5, overall: 4.6, focus: 4.4, pressure: 4.5, relief: 4.5, early: true },
].map((row) => ({ ...row, adjusted: adjustedScore(row.score, row.count) }));

const STEP_HEIGHT: Record<number, string> = {
  1: "h-44",
  2: "h-32",
  3: "h-24",
};
const STEP_DELAY: Record<number, string> = {
  1: "0.36s",
  2: "0.16s",
  3: "0s",
};

function TopScores({ rows }: { rows: TherapistStanding[] }) {
  const t = getT();
  const top = rows
    .filter((row) => row.count > 0)
    .sort((a, b) => b.adjusted - a.adjusted || b.count - a.count)
    .slice(0, 3);
  const stage = top.length >= 2 ? [top[1], top[0], ...top.slice(2)] : top;

  return (
    <section className="award-stage card overflow-hidden">
      <div className="award-stage-head">
        <h3>{t("Top 3")}</h3>
        <p>{t("The three highest scores.")}</p>
      </div>
      <div className="award-floor">
        <div className="mx-auto flex max-w-xl items-end justify-center gap-2 sm:gap-3">
          {stage.map((row) => {
            const rank = top.indexOf(row) + 1;
            return (
              <div
                key={row.id}
                className={rank === 1 ? "award-column flex min-w-0 flex-[1.15] flex-col items-center" : "award-column flex min-w-0 flex-1 flex-col items-center"}
                style={{ animationDelay: STEP_DELAY[rank] }}
              >
                <div className="mb-2 flex w-full flex-col items-center">
                  {rank === 1 ? <Trophy size={20} className="award-trophy mb-1" aria-hidden="true" /> : <span className="mb-1 h-5" />}
                  <p className="award-name w-full truncate text-center font-sans text-sm font-semibold">{row.name}</p>
                  <p className="award-score text-center font-sans text-xs font-semibold">{row.adjusted.toFixed(1)} / 5</p>
                </div>
                <div className={`award-step flex w-full items-center justify-center ${STEP_HEIGHT[rank] ?? STEP_HEIGHT[3]}`} data-rank={rank}>
                  <span className={rank === 1 ? "font-sans text-5xl font-semibold leading-none" : "font-sans text-4xl font-semibold leading-none"}>{rank}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const SAMPLE_NOTES: ScoreNote[] = [
  { id: "sample-note-1", therapistId: "sample-14", guestNickname: "Amy", timeSlot: "10:30", comment: "Pressure was comfortable and the session felt careful.", when: "20 Oct 2026, 11:00 AM" },
  { id: "sample-note-2", therapistId: "sample-1", guestNickname: "Chris", timeSlot: "14:00", comment: "Very focused from start to finish.", when: "20 Oct 2026, 2:10 PM" },
];

export default function MassageLeaderboard({
  rows,
  notes = [],
  demo = false,
}: {
  rows: TherapistStanding[];
  notes?: ScoreNote[];
  demo?: boolean;
}) {
  const t = getT();
  const ranked = rows.filter((row) => row.count > 0);

  if (ranked.length === 0 && demo) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-card border border-line bg-paper px-4 sm:px-5 py-4">
          <p className="text-xs font-semibold text-brand-700">{t("Sample preview")}</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">
            {t("These names and scores are an example for review. They are not guest results.")}
          </p>
        </div>
        <TopScores rows={SAMPLE_ROWS} />
        <MassageScoreLookup rows={SAMPLE_ROWS} notes={SAMPLE_NOTES} />
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <h3 className="font-sans text-lg font-semibold text-ink mb-1">{t("No guest scores yet")}</h3>
        <p className="text-sm text-ink-muted max-w-sm mx-auto">
          {t("After guests scan an event QR code, the scores show up here.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <TopScores rows={rows} />
      <MassageScoreLookup rows={rows} notes={notes} />
    </div>
  );
}
