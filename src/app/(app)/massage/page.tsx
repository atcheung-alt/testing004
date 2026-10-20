import { formatDate, formatDateTime } from "@/lib/calculations";
import { getT } from "@/lib/i18n/server";
import { listMassageBoard, listMassageComments, therapistStandings } from "@/lib/massage";
import MassageEventSearch from "@/components/MassageEventSearch";
import MassageLeaderboard from "@/components/MassageLeaderboard";
import MassageRoster from "@/components/MassageRoster";
import PageBar from "@/components/PageBar";
import PageVideo from "@/components/PageVideo";

export const dynamic = "force-dynamic";

export default async function MassagePage() {
  const t = getT();
  const [standings, board, comments] = await Promise.all([
    therapistStandings(),
    listMassageBoard(),
    listMassageComments(),
  ]);
  const ranked = standings.filter((row) => row.count > 0);
  const surveyCount = board.scheduled.reduce((sum, event) => sum + event.surveyCount, 0);
  const leading = ranked[0];

  return (
    <PageVideo clip="massage">
    <div className="flex flex-col gap-4">
      <PageBar
        title={t("Results")}
        note={t("Therapist scores, before you open an event. Average of overall, care, pressure, and relief. 5 is the highest. Under 8 surveys is marked Early.")}
      />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{t("Surveys")}</p>
          <p className="font-mono text-2xl mt-1">{surveyCount}</p>
        </div>
        <div className="card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("Therapists with scores")}
          </p>
          <p className="font-mono text-2xl mt-1">{ranked.length}</p>
        </div>
        <div className="card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{t("Leading score")}</p>
          <p className="font-mono text-2xl mt-1">{leading ? leading.adjusted.toFixed(1) : "—"}</p>
        </div>
      </section>

      <MassageLeaderboard
        rows={standings}
        demo={ranked.length === 0}
        notes={comments.map((row) => ({
          id: row.id,
          therapistId: row.therapistId,
          guestNickname: row.guestNickname,
          timeSlot: row.timeSlot,
          comment: row.comment,
          when: formatDateTime(row.createdAt),
        }))}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{t("Massage events")}</h2>
          <p className="lead">
            {t("Each event has its own QR code. Attach the invoice after the day.")}
          </p>
        </div>
        {board.scheduled.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <h3 className="font-display text-lg font-semibold mb-1">{t("No massage events yet")}</h3>
            <p className="text-sm text-ink-muted">
              {t("Create a booking for the massage day. Its QR code shows up here. The invoice can wait until the event is over.")}
            </p>
          </div>
        ) : (
          <MassageEventSearch
            events={board.scheduled.map((event) => {
              const sameDay = formatDate(event.startDate) === formatDate(event.endDate);
              const when = sameDay
                ? formatDate(event.startDate)
                : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
              const detail = [
                event.number ?? t("Invoice not attached yet"),
                event.customerName,
                when,
              ]
                .filter(Boolean)
                .join(" · ");
              return {
                id: event.id,
                name: event.name,
                detail,
                score: event.surveyCount > 0 ? event.score.toFixed(1) : "—",
                surveyCount: event.surveyCount,
              };
            })}
          />
        )}
      </section>

      <MassageRoster
        therapists={[...standings]
          .sort((a, b) => a.name.localeCompare(b.name, "zh-HK"))
          .map((row) => ({ id: row.id, name: row.name }))}
      />
    </div>
    </PageVideo>
  );
}
