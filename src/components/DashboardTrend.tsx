"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";
import type { TrendMonth } from "@/lib/finance";

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

const SERIES = [
  { key: "revenue", stroke: "#4f7cff", label: "Revenue" },
  { key: "expenses", stroke: "#c4483a", label: "Expenses" },
  { key: "profit", stroke: "#9b6bea", label: "Net Profit" },
] as const;

function axisAmount(value: number) {
  return new Intl.NumberFormat("en-HK", { maximumFractionDigits: 0 }).format(value);
}

export default function DashboardTrend({
  months,
}: {
  months: TrendMonth[];
  year?: number;
  month?: number;
}) {
  const t = useT();
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(Math.max(months.length - 1, 0));
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => months.slice(from, to + 1), [months, from, to]);

  const width = 720;
  const height = 240;
  const left = 64;
  const right = 16;
  const top = 16;
  const bottom = 32;
  const values = rows.flatMap((row) => [row.revenue, row.expenses, row.profit]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const xOf = (index: number) => left + (rows.length <= 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW);
  const yOf = (value: number) => top + ((max - value) / span) * innerH;
  function label(row: TrendMonth) {
    const name = t(MONTHS[row.month]);
    const short = name.length > 3 ? name.slice(0, 3) : name;
    return `${short} ${String(row.year).slice(2)}`;
  }

  function move(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * width;
    let nearest = 0;
    rows.forEach((_, index) => {
      if (Math.abs(xOf(index) - x) < Math.abs(xOf(nearest) - x)) nearest = index;
    });
    setHover(nearest);
  }

  const ticks = Array.from({ length: 5 }, (_, index) => min + (span * index) / 4);
  const pointed = hover === null ? null : rows[hover];
  const tipLeft = hover === null ? 0 : Math.min(Math.max((xOf(hover) / width) * 100, 4), 72);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-lg font-semibold">{t("Trend")}</h2>
        <div className="flex gap-3.5 text-xs text-ink-muted">
          {SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: series.stroke }} />
              {t(series.label)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mb-3">
        <span>{t("From")}</span>
        <select
          className="input !w-auto"
          aria-label={t("From")}
          value={from}
          onChange={(event) => {
            const next = Number(event.target.value);
            setFrom(next);
            if (next > to) setTo(next);
          }}
        >
          {months.map((row, index) => (
            <option key={`${row.year}-${row.month}`} value={index}>
              {t(MONTHS[row.month])} {row.year}
            </option>
          ))}
        </select>
        <span>{t("to")}</span>
        <select
          className="input !w-auto"
          aria-label={t("to")}
          value={to}
          onChange={(event) => {
            const next = Number(event.target.value);
            setTo(next);
            if (next < from) setFrom(next);
          }}
        >
          {months.map((row, index) => (
            <option key={`${row.year}-${row.month}-to`} value={index}>
              {t(MONTHS[row.month])} {row.year}
            </option>
          ))}
        </select>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block w-full h-60" role="img" onMouseMove={move} onMouseLeave={() => setHover(null)}>
          {ticks.map((value) => {
            const y = yOf(value);
            return (
              <g key={value}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e3e8f3" strokeWidth="1" />
                <text x={left - 8} y={y + 4} textAnchor="end" fill="#9aa3b8" fontSize="11">
                  {axisAmount(value)}
                </text>
              </g>
            );
          })}
          {hover !== null ? (
            <line
              x1={xOf(hover)}
              y1={top}
              x2={xOf(hover)}
              y2={height - bottom}
              stroke="#94a3b8"
              strokeDasharray="3 3"
            />
          ) : null}
          {SERIES.map((series) => {
            const d = rows
              .map((row, index) => `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)} ${yOf(row[series.key]).toFixed(1)}`)
              .join(" ");
            return (
              <g key={series.key}>
                <path d={d} fill="none" stroke={series.stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity={hover === null ? 1 : 0.35} />
                {rows.map((row, index) => (
                  <g key={`${series.key}-${row.year}-${row.month}`} opacity={hover === null || index === hover ? 1 : 0.25}>
                    {index === hover ? (
                      <circle cx={xOf(index)} cy={yOf(row[series.key])} r="8" fill="#fff" stroke={series.stroke} strokeWidth="3" />
                    ) : null}
                    <circle
                      cx={xOf(index)}
                      cy={yOf(row[series.key])}
                      r={index === hover ? 4 : 3}
                      fill={series.stroke}
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                  </g>
                ))}
              </g>
            );
          })}
          {rows.map((row, index) => {
            return (
              <text key={`${row.year}-${row.month}`} x={xOf(index)} y={height - 8} textAnchor="middle" fill="#9aa3b8" fontSize="11">
                {label(row)}
              </text>
            );
          })}
        </svg>
        {pointed ? (
          <div
            className="absolute z-10 min-w-[160px] rounded-xl border border-line bg-white px-2.5 py-2 text-xs shadow-lg pointer-events-none"
            style={{ left: tipLeft + "%", top: 12 }}
          >
            <p className="font-semibold mb-1">
              {t(MONTHS[pointed.month])} {pointed.year}
            </p>
            {SERIES.map((series) => (
              <p key={series.key} className="flex justify-between gap-3 text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: series.stroke }} />
                  {t(series.label)}
                </span>
                <span>{formatCurrency(pointed[series.key])}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
