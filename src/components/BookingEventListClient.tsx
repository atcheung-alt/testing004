"use client";

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
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-ink-faint">
            <th className="px-5 py-3">{t("Event")}</th>
            <th className="hidden sm:table-cell px-5 py-3">{t("Dates")}</th>
            <th className="px-5 py-3 text-right">{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <ClickableTableRow
              key={e.id}
              href={`/bookings/${e.id}`}
              className="border-b border-line last:border-0 hover:bg-brand-50/40"
            >
              <td className="px-5 py-3">
                <span className="font-medium text-ink">{e.name}</span>
                {e.description && (
                  <p className="text-xs text-ink-muted truncate max-w-xs">{e.description}</p>
                )}
              </td>
              <td className="hidden sm:table-cell px-5 py-3 text-ink-muted">
                {dateRangeLabel(e.startDate, e.endDate)}
              </td>
              <td className="px-5 py-3 text-right">
                <span className={e.active ? "text-xs font-medium text-brand-600" : "text-xs font-medium text-ink-faint"}>
                  {e.active ? t("Active") : t("Inactive")}
                </span>
              </td>
            </ClickableTableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
