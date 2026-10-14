import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getEffectiveCompany } from "@/lib/appSettings";
import { listBookingEvents, formatDateLabel } from "@/lib/bookings";
import PublicBookingShell from "@/components/PublicBookingShell";
import { getAppLanguage, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const t = getT();
  return {
    title: t("Book an appointment"),
  };
}

function dateRangeLabel(startDate: Date, endDate: Date): string {
  const start = formatDateLabel(startDate);
  const end = formatDateLabel(endDate);
  return start === end ? start : `${start} – ${end}`;
}

export default async function BookEventsPage() {
  const t = getT();
  const language = getAppLanguage();
  const [company, events] = await Promise.all([getEffectiveCompany(), listBookingEvents({ activeOnly: true })]);
  const monthFormat = new Intl.DateTimeFormat(language === "zh" ? "zh-HK" : "en-HK", { month: "short" });

  return (
    <PublicBookingShell
      company={{ name: company.name, shortName: company.shortName, logoData: company.logoData, logoDataDark: company.logoDataDark }}
    >
      <div className="max-w-2xl flex flex-col gap-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{t("Book an appointment")}</h1>
          <p className="text-sm text-ink-muted mt-2">{t("Choose an event. Next you pick a day, then a time.")}</p>
        </div>

        {events.length === 0 ? (
          <div className="card p-10 text-center text-sm text-ink-muted">{t("Nothing is available to book right now.")}</div>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/book/${event.id}`}
                className="card p-4 sm:p-5 flex items-center gap-4 hover:border-brand-300 transition-colors"
              >
                <div className="w-14 shrink-0 rounded-md border border-line bg-paper py-2 text-center">
                  <div className="text-[11px] font-medium uppercase text-ink-faint">{monthFormat.format(event.startDate)}</div>
                  <div className="text-lg font-semibold text-ink leading-none mt-0.5">{event.startDate.getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold text-ink">{event.name}</h2>
                  {event.companyName && (
                    <p className="text-sm text-ink mt-0.5">{t("For {company}", { company: event.companyName })}</p>
                  )}
                  {event.description && <p className="text-sm text-ink-muted mt-0.5 line-clamp-2">{event.description}</p>}
                  <p className="text-xs text-ink-faint mt-1.5">{dateRangeLabel(event.startDate, event.endDate)}</p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-brand-600 shrink-0">
                  {t("Book")} <ArrowRight size={16} />
                </span>
                <ArrowRight size={18} className="sm:hidden text-brand-600 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicBookingShell>
  );
}
