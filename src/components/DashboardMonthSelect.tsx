"use client";

import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function DashboardMonthSelect({ year, month, total = false }: { year: number; month: number; total?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => currentYear - index);

  function go(nextYear: number, nextMonth: number) {
    const params = new URLSearchParams();
    params.set("month", `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="input !w-auto"
        aria-label={t("Month")}
        value={total ? "" : month}
        onChange={(event) => {
          if (event.target.value === "") return;
          go(year, Number(event.target.value));
        }}
      >
        {total ? <option value="">{t("Month")}</option> : null}
        {MONTHS.map((name, index) => (
          <option key={name} value={index}>
            {t(name)}
          </option>
        ))}
      </select>
      <select
        className="input !w-auto"
        aria-label={t("Year")}
        value={total ? "" : year}
        onChange={(event) => {
          if (event.target.value === "") return;
          go(Number(event.target.value), month);
        }}
      >
        {total ? <option value="">{t("Year")}</option> : null}
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-pressed={total}
        onClick={() => router.push(`${pathname}?month=total`)}
        className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold ${
          total ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-ink"
        }`}
      >
        {t("Total")}
      </button>
    </div>
  );
}
