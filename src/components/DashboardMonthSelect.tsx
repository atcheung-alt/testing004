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

export default function DashboardMonthSelect({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => currentYear - index);

  function go(nextYear: number, nextMonth: number) {
    const now = new Date();
    if (nextYear === now.getFullYear() && nextMonth === now.getMonth()) {
      router.push(pathname);
      return;
    }
    const params = new URLSearchParams();
    params.set("month", `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-2">
      <select
        className="input !w-auto"
        aria-label={t("Month")}
        value={month}
        onChange={(event) => go(year, Number(event.target.value))}
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index}>
            {t(name)}
          </option>
        ))}
      </select>
      <select
        className="input !w-auto"
        aria-label={t("Year")}
        value={year}
        onChange={(event) => go(Number(event.target.value), month)}
      >
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
