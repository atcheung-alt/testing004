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

const BAR_COLORS = ["bg-brand-500", "bg-cyan-500", "bg-accent-500"] as const;
const SCORE_COLORS = ["text-brand-700", "text-cyan-600", "text-accent-600"] as const;

function TopScores({ rows }: { rows: TherapistStanding[] }) {
  const t = getT();
  const top = rows
    .filter((row) => row.count > 0)
    .sort((a, b) => b.adjusted - a.adjusted || b.count - a.count)
    .slice(0, 3);

  return (
    <section className="flex flex-col gap-3 animate-rise" style={{ animationDelay: "260ms" }}>
      <div>
        <h3 className="font-display text-xl font-semibold">{t("Top 3")}</h3>
        <p className="text-sm text-ink-muted mt-1">{t("The three highest scores.")}</p>
      </div>
      <div className="card px-4 sm:px-5 py-5 flex flex-col gap-5">
        {top.map((row, index) => (
          <div key={row.id}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <p className="font-medium truncate">{row.name}</p>
              <p className={`font-mono text-sm shrink-0 ${SCORE_COLORS[index] ?? SCORE_COLORS[0]}`}>
                {row.adjusted.toFixed(1)} / 5
              </p>
            </div>
            <p className="text-xs text-ink-muted mb-2">{t("{count} surveys", { count: row.count })}</p>
            <div className="relative h-2.5 rounded-full bg-paper overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full animate-fill-bar ${BAR_COLORS[index] ?? BAR_COLORS[0]}`}
                style={{ ["--bar" as string]: `${(row.adjusted / 5) * 100}%`, animationDelay: `${320 + index * 120}ms` }}
              />
              <span className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-sheen" />
            </div>
          </div>
        ))}
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
        <h3 className="font-display text-lg font-semibold mb-1">{t("No guest scores yet")}</h3>
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
