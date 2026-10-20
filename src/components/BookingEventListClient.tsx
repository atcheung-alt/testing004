"use client";

import Link from "next/link";
import clsx from "clsx";
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
      <div className="flex flex-col gap-2">
        {shown.map((e) => (
            <Link
              key={e.id}
              href={`/bookings/${e.id}`}
              className={clsx(
                "event-ticket flex items-center gap-3 rounded-lg border border-line px-3 py-3 no-underline transition-colors hover:bg-paper",
                e.active ? "bg-surface" : "bg-paper/40"
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-art text-base font-semibold tracking-wide text-ink">{e.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-art text-sm text-ink">
                  <span>{dateRangeLabel(e.startDate, e.endDate)}</span>
                  {e.description ? <span className="truncate">{e.description}</span> : null}
                </span>
              </span>
              <span className={clsx("stamp shrink-0", e.active ? "border-brand-500 text-brand-600" : "border-line text-ink-muted")}>
                {e.active ? t("Active") : t("Inactive")}
              </span>
            </Link>
        ))}
      </div>
    </section>
  );
}
