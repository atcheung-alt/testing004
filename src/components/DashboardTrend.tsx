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

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  let path = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i - 1] || points[i];
    const current = points[i];
    const next = points[i + 1];
    const after = points[i + 2] || next;
    const c1x = current.x + (next.x - prev.x) / 6;
    const c1y = current.y + (next.y - prev.y) / 6;
    const c2x = next.x - (after.x - current.x) / 6;
    const c2y = next.y - (after.y - current.y) / 6;
    path += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
}

function monthValue(row: TrendMonth) {
  return `${row.year}-${String(row.month + 1).padStart(2, "0")}`;
}

function axisAmount(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${Math.round(value / 1000)}k`;
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
  const last = Math.max(months.length - 1, 0);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(last);
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => months.slice(from, to + 1), [months, from, to]);
  const firstValue = months[0] ? monthValue(months[0]) : "";
  const lastValue = months[last] ? monthValue(months[last]) : "";

  const width = 760;
  const height = 280;
  const left = 58;
  const right = 16;
  const top = 18;
  const bottom = 36;
  const values = rows.flatMap((row) => [row.revenue, row.expenses, row.profit]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const xOf = (index: number) => left + (rows.length <= 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW);
  const yOf = (value: number) => top + ((max - value) / span) * innerH;
  const ticks = Array.from({ length: 4 }, (_, index) => min + (span * index) / 3);
  const pointed = hover === null ? null : rows[hover];
  const tipPercent = hover === null ? 0 : (xOf(hover) / width) * 100;
  const tipLeft = tipPercent > 62 ? Math.max(tipPercent - 28, 2) : Math.min(tipPercent + 2, 72);
  const labelEvery = rows.length > 24 ? 12 : rows.length > 12 ? 3 : 1;

  function shortLabel(row: TrendMonth, index: number) {
    if (rows.length > 18 && row.month === 0) return String(row.year);
    if (rows.length > 18 && index !== 0 && index !== rows.length - 1) return String(row.year);
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

  function pick(value: string, edge: "from" | "to") {
    const index = months.findIndex((row) => monthValue(row) === value);
    if (index < 0) return;
    if (edge === "from") {
      setFrom(index);
      if (index > to) setTo(index);
    } else {
      setTo(index);
      if (index < from) setFrom(index);
    }
    setHover(null);
  }

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
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mb-2">
        <span>{t("From")}</span>
        <input
          type="month"
          className="input !w-auto"
          aria-label={t("From")}
          min={firstValue}
          max={lastValue}
          value={months[from] ? monthValue(months[from]) : ""}
          onChange={(event) => pick(event.target.value, "from")}
        />
        <span>{t("to")}</span>
        <input
          type="month"
          className="input !w-auto"
          aria-label={t("to")}
          min={firstValue}
          max={lastValue}
          value={months[to] ? monthValue(months[to]) : ""}
          onChange={(event) => pick(event.target.value, "to")}
        />
        <button
          type="button"
          className="text-xs font-semibold text-brand-600 px-1"
          onClick={() => {
            setFrom(0);
            setTo(last);
            setHover(null);
          }}
        >
          {t("Whole period")}
        </button>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block w-full h-72" role="img" onMouseMove={move} onMouseLeave={() => setHover(null)}>
          {ticks.map((value) => {
            const y = yOf(value);
            return (
              <g key={value}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="#eef2f8" strokeWidth="1" />
                <text x={left - 8} y={y + 4} textAnchor="end" fill="#9aa3b8" fontSize="11">
                  {axisAmount(value)}
                </text>
              </g>
            );
          })}
          {SERIES.map((series) => {
            const line = smoothPath(rows.map((row, index) => ({ x: xOf(index), y: yOf(row[series.key]) })));
            const area =
              rows.length > 1
                ? `${line} L${xOf(rows.length - 1).toFixed(1)} ${yOf(0)} L${xOf(0).toFixed(1)} ${yOf(0)} Z`
                : "";
            return (
              <g key={series.key}>
                {series.key !== "profit" && area ? <path d={area} fill={series.stroke} opacity="0.08" /> : null}
                <path d={line} fill="none" stroke={series.stroke} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
          {hover !== null ? (
            <g>
              <line x1={xOf(hover)} y1={top} x2={xOf(hover)} y2={height - bottom} stroke="#94a3b8" strokeDasharray="3 3" />
              {SERIES.map((series) => (
                <circle
                  key={series.key}
                  cx={xOf(hover)}
                  cy={yOf(rows[hover][series.key])}
                  r="7"
                  fill="#fff"
                  stroke={series.stroke}
                  strokeWidth="3"
                />
              ))}
            </g>
          ) : null}
          {rows.map((row, index) => {
            const show = index === 0 || index === rows.length - 1 || (labelEvery === 1) || (row.month === 0 && index % labelEvery === 0);
            if (!show) return null;
            return (
              <text key={`${row.year}-${row.month}`} x={xOf(index)} y={height - 10} textAnchor="middle" fill="#9aa3b8" fontSize="11">
                {shortLabel(row, index)}
              </text>
            );
          })}
        </svg>
        {pointed ? (
          <div
            className="absolute z-10 min-w-[190px] rounded-xl border border-line bg-white px-3 py-2.5 text-xs shadow-lg pointer-events-none"
            style={{ left: tipLeft + "%", top: 12 }}
          >
            <p className="font-semibold mb-1.5">
              {t(MONTHS[pointed.month])} {pointed.year}
            </p>
            {SERIES.map((series) => (
              <p key={series.key} className="flex justify-between gap-4 text-ink-muted my-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: series.stroke }} />
                  {t(series.label)}
                </span>
                <span className="font-semibold tabular-nums text-ink">{formatCurrency(pointed[series.key])}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
