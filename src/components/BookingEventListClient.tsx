"use client";

import clsx from "clsx";
import ClickableTableRow from "@/components/ClickableTableRow";
import { useT } from "@/lib/i18n/client";
import { formatDateLabel } from "@/lib/bookingFormat";

export type BookingEventListItem = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

/** "24/08/2026" or "24/08/2026 – 26/08/2026" once an event spans more than
 *  one day. */
function dateRangeLabel(startDate: string, endDate: string): string {
  const start = formatDateLabel(startDate);
  const end = formatDateLabel(endDate);
  return start === end ? start : `${start} – ${end}`;
}

export default function BookingEventListClient({ events }: { events: BookingEventListItem[] }) {
  const t = useT();
  const shown = [...events].sort((a, b) => Number(b.active) - Number(a.active) || a.startDate.localeCompare(b.startDate));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-lg font-semibold text-ink">{t("Events")}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Event")}</th>
              <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Dates")}</th>
              <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <ClickableTableRow
                key={e.id}
                href={`/bookings/${e.id}`}
                className="border-b border-line last:border-0 hover:bg-paper"
              >
                <td className="px-4 py-3">
                  <p className="font-sans font-medium text-ink">{e.name}</p>
                  {e.description ? <p className="font-sans text-ink-muted mt-0.5">{e.description}</p> : null}
                </td>
                <td className="px-4 py-3 font-sans text-ink whitespace-nowrap">{dateRangeLabel(e.startDate, e.endDate)}</td>
                <td className="px-4 py-3">
                  <span className={clsx("stamp", e.active ? "border-brand-500 text-brand-600" : "border-line text-ink-muted")}>
                    {e.active ? t("Active") : t("Inactive")}
                  </span>
                </td>
              </ClickableTableRow>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
