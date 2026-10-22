import type { CSSProperties } from "react";
import { LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import AnimatedAmount from "@/components/AnimatedAmount";

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
  detail,
  amount,
  className = "",
  style,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: "brand" | "accent" | "ink" | "danger";
  detail?: string;
  amount?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const t = getT();
  const accentClasses =
    accent === "accent"
      ? "bg-accent-100 text-accent-600"
      : accent === "ink"
      ? "bg-paper text-ink-muted"
      : accent === "danger"
      ? "bg-danger-50 text-danger-500"
      : "bg-brand-50 text-brand-500";

  return (
    <div className={`card p-5 flex items-start justify-between animate-rise ${className}`} style={style}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
          {t(label)}
        </p>
        {typeof amount === "number" ? (
          <AnimatedAmount value={amount} className="font-mono text-2xl font-semibold text-ink" />
        ) : (
          <p className="font-mono text-2xl font-semibold text-ink">{value}</p>
        )}
        {detail ? <p className="text-xs text-ink-muted mt-1">{detail}</p> : null}
      </div>
      {Icon ? (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentClasses}`}>
          <Icon size={18} />
        </div>
      ) : null}
    </div>
  );
}
