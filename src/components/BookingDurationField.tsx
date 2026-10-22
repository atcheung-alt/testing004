"use client";

import { useT } from "@/lib/i18n/client";
import { SLOT_DURATION_MAX_MINUTES, formatDurationLabel } from "@/lib/bookingFormat";

/** A plain minutes box. Staff type any whole number, rather than picking 15, 30, 45, or 60. */
export default function BookingDurationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const t = useT();
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        className="input"
        value={value > 0 ? String(value) : ""}
        placeholder={t("e.g. 20")}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
          onChange(digits ? Math.min(SLOT_DURATION_MAX_MINUTES, Number(digits)) : 0);
        }}
      />
      <p className="mt-1 text-xs text-ink-faint">
        {t("Type any number of minutes, for example 20.")}
        {value > 0 ? ` ${formatDurationLabel(value)}` : ""}
      </p>
    </>
  );
}
