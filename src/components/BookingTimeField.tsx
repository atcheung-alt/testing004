"use client";

import clsx from "clsx";

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parseTime(value: string): { hour12: number; minute: number; period: "AM" | "PM" } {
  const [hourText, minuteText] = value.split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText);
  const safeHour = Number.isFinite(hour24) ? ((hour24 % 24) + 24) % 24 : 9;
  const safeMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;
  const period: "AM" | "PM" = safeHour >= 12 ? "PM" : "AM";
  const hour12 = safeHour % 12 || 12;
  return { hour12, minute: safeMinute, period };
}

function to24Hour(hour12: number, minute: number, period: "AM" | "PM"): string {
  const base = hour12 % 12;
  const hour24 = period === "PM" ? base + 12 : base;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Hour, minute, and English AM/PM. The value stored is still 24-hour "HH:mm". */
export default function BookingTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { hour12, minute, period } = parseTime(value);
  const minutes = MINUTE_STEPS.includes(minute) ? MINUTE_STEPS : [...MINUTE_STEPS, minute].sort((a, b) => a - b);

  function update(next: { hour12?: number; minute?: number; period?: "AM" | "PM" }) {
    onChange(to24Hour(next.hour12 ?? hour12, next.minute ?? minute, next.period ?? period));
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="input w-[4.75rem]"
        aria-label="Hour"
        value={hour12}
        onChange={(e) => update({ hour12: Number(e.target.value) })}
      >
        {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="text-ink-muted">:</span>
      <select
        className="input w-[4.75rem]"
        aria-label="Minute"
        value={minute}
        onChange={(e) => update({ minute: Number(e.target.value) })}
      >
        {minutes.map((step) => (
          <option key={step} value={step}>
            {String(step).padStart(2, "0")}
          </option>
        ))}
      </select>
      <div className="flex rounded-md border border-line overflow-hidden shrink-0">
        {(["AM", "PM"] as const).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => update({ period: label })}
            className={clsx(
              "px-3 py-2 text-sm font-medium",
              period === label ? "bg-brand-600 text-white" : "bg-surface text-ink-muted hover:bg-paper"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
