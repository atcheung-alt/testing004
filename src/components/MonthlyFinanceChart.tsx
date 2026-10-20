import type { MonthlyFinance } from "@/lib/finance";
import { getT } from "@/lib/i18n/server";

const COLORS = {
  revenue: "#4F7CFF", // brand-500
  expenses: "#C4483A", // danger-500
  profit: "#9B6BEA", // accent-500
  grid: "#E3E8F3", // line
  axisText: "#9AA3B8", // ink-faint
};

/** Round up to a "nice" number for the axis ceiling (1000, 2000, 5000, 10000, ...). */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export default function MonthlyFinanceChart({ data }: { data: MonthlyFinance[] }) {
  const t = getT();
  const width = 760;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 44, left: 64 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.flatMap((d) => [d.revenue, d.expenses, d.profit]);
  const rawMax = Math.max(0, ...values);
  const rawMin = Math.min(0, ...values);
  const maxValue = niceCeil(rawMax);
  const minValue = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const range = maxValue - minValue || 1;

  function y(value: number): number {
    return padding.top + chartH - ((value - minValue) / range) * chartH;
  }

  const zeroY = y(0);
  const groupWidth = chartW / Math.max(data.length, 1);
  const barWidth = Math.min(16, groupWidth / 3.4);
  const gridLines = 4;

  const profitPoints = data.map((d, i) => ({
    x: padding.left + groupWidth * i + groupWidth / 2,
    y: y(d.profit),
  }));
  const profitPath = profitPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img">
        {/* Horizontal grid lines + axis value labels */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const value = minValue + (range / gridLines) * i;
          const yy = y(value);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yy}
                y2={yy}
                stroke={COLORS.grid}
                strokeWidth={1}
              />
              <text x={padding.left - 8} y={yy} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={COLORS.axisText}>
                {Math.round(value).toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Zero baseline, emphasized when the range dips negative */}
        {minValue < 0 && (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={zeroY}
            y2={zeroY}
            stroke={COLORS.axisText}
            strokeWidth={1}
          />
        )}

        {/* Revenue / expenses bars */}
        {data.map((d, i) => {
          const groupX = padding.left + groupWidth * i;
          const center = groupX + groupWidth / 2;
          const revTop = Math.min(y(d.revenue), zeroY);
          const revHeight = Math.abs(zeroY - y(d.revenue));
          const expTop = Math.min(y(d.expenses), zeroY);
          const expHeight = Math.abs(zeroY - y(d.expenses));
          return (
            <g key={d.month}>
              <rect
                x={center - barWidth - 2}
                y={revTop}
                width={barWidth}
                height={Math.max(revHeight, 0.5)}
                fill={COLORS.revenue}
                rx={2}
              />
              <rect
                x={center + 2}
                y={expTop}
                width={barWidth}
                height={Math.max(expHeight, 0.5)}
                fill={COLORS.expenses}
                rx={2}
              />
              <text
                x={center}
                y={height - padding.bottom + 16}
                textAnchor="end"
                fontSize={10}
                fill={COLORS.axisText}
                transform={`rotate(-40 ${center} ${height - padding.bottom + 16})`}
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Net profit line */}
        <path d={profitPath} fill="none" stroke={COLORS.profit} strokeWidth={2} />
        {profitPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={COLORS.profit} />
        ))}
      </svg>

      <div className="flex items-center gap-5 mt-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.revenue }} /> {t("Revenue")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expenses }} /> {t("Expenses")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.profit }} /> {t("Net Profit")}
        </span>
      </div>
    </div>
  );
}
