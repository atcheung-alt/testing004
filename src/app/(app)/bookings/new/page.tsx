import NewBookingEventForm from "@/components/NewBookingEventForm";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewBookingEventPage() {
  const t = getT();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("New Booking Event")}</h1>
        <p className="text-sm text-ink-muted">
          {t(
            "Name the visit, the day, and the hours. The times are created for you. Clients only see a time that still has a seat."
          )}
        </p>
      </div>

      <NewBookingEventForm />
    </div>
  );
}
