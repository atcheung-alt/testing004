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

function TopScores({ rows }: { rows: TherapistStanding[] }) {
  const t = getT();
  const top = rows
    .filter((row) => row.count > 0)
    .sort((a, b) => b.adjusted - a.adjusted || b.count - a.count)
    .slice(0, 3);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-sans text-lg font-semibold text-ink">{t("Top 3")}</h3>
        <p className="mt-0.5 text-sm text-ink-muted">{t("The three highest scores.")}</p>
      </div>
      <div className="card divide-y divide-line">
        {top.map((row, index) => (
          <div key={row.id} className="flex items-center gap-4 px-4 py-3">
            <span className="w-5 shrink-0 font-sans text-sm font-semibold text-ink-muted">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-sans font-medium text-ink truncate">{row.name}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t("{count} surveys", { count: row.count })}</p>
            </div>
            <p className="font-sans text-sm font-semibold text-ink shrink-0">{row.adjusted.toFixed(1)} / 5</p>
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
