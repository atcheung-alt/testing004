import Link from "next/link";
import { Medal } from "lucide-react";
import { formatDate } from "@/lib/calculations";
import { getT } from "@/lib/i18n/server";
import { listMassageBoard, therapistStandings } from "@/lib/massage";
import MassageLeaderboard from "@/components/MassageLeaderboard";

export const dynamic = "force-dynamic";

export default async function MassagePage() {
  const t = getT();
  const [standings, board] = await Promise.all([therapistStandings(), listMassageBoard()]);
  const ranked = standings.filter((row) => row.count > 0);
  const surveyCount = board.scheduled.reduce((sum, event) => sum + event.surveyCount, 0);
  const leading = ranked[0];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex items-center gap-2 text-brand-600 mb-2">
          <Medal size={18} />
          <p className="text-xs font-semibold uppercase tracking-wide">{t("Massage")}</p>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("Massage performance")}</h1>
        <p className="text-sm text-ink-muted mt-2 max-w-2xl">
          {t("Guest scores after each event, ranked so you can see which therapist is doing better.")}
        </p>
        <p className="text-xs text-ink-faint mt-2 max-w-2xl">
          {t(
            "The score is the average of four questions: overall, focus, pressure, and relief. 5 is the best. Fewer than 8 surveys is marked Early, and still counts in the ranking."
          )}
        </p>
      </header>

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
          <p className="font-mono text-2xl mt-1">{leading ? leading.score.toFixed(1) : "—"}</p>
        </div>
      </section>

      <MassageLeaderboard rows={standings} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{t("Massage events")}</h2>
          <p className="text-sm text-ink-muted mt-1">
            {t("A QR code is created when a massage invoice is marked on the calendar. Each calendar event has its own code.")}
          </p>
        </div>
        {board.scheduled.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <h3 className="font-display text-lg font-semibold mb-1">{t("No massage events yet")}</h3>
            <p className="text-sm text-ink-muted">
              {t("Mark a massage invoice on the calendar and it will show up here with a QR code.")}
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-line">
            {board.scheduled.map((event) => {
              const sameDay = formatDate(event.startDate) === formatDate(event.endDate);
              const when = sameDay
                ? formatDate(event.startDate)
                : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
              return (
                <Link
                  key={event.id}
                  href={`/massage/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-paper"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{event.name}</p>
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {event.number}
                      {event.customerName ? ` · ${event.customerName}` : ""}
                      {` · ${when}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-lg font-medium text-brand-700">
                      {event.surveyCount > 0 ? event.score.toFixed(1) : "—"}
                    </p>
                    <p className="text-xs text-ink-muted">{t("{count} surveys", { count: event.surveyCount })}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {board.pending.length > 0 && (
          <div className="card divide-y divide-line">
            <div className="px-4 sm:px-5 py-3">
              <h3 className="text-sm font-semibold">{t("Not on the calendar yet")}</h3>
              <p className="text-xs text-ink-muted mt-1">
                {t("Mark the invoice on the calendar to get a QR code for this massage.")}
              </p>
            </div>
            {board.pending.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-paper"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{invoice.title || invoice.customerName || invoice.number}</p>
                  <p className="text-xs text-ink-muted truncate mt-0.5">
                    {invoice.number}
                    {invoice.customerName ? ` · ${invoice.customerName}` : ""}
                    {` · ${formatDate(invoice.issueDate)}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
