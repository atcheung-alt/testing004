import type { CSSProperties } from "react";
import { LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import AnimatedAmount from "@/components/AnimatedAmount";

export default function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  amount,
  className = "",
  style,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "brand" | "accent" | "ink" | "danger";
  detail?: string;
  amount?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const t = getT();

  return (
    <div className={`card p-5 flex items-start justify-between ${className}`} style={style}>
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
      <Icon size={18} className="text-ink-muted" />
    </div>
  );
}
