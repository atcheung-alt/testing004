import type { CSSProperties } from "react";
import { LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import AnimatedAmount from "@/components/AnimatedAmount";

export default function StatCard({
  label,
  value,
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

  return (
    <div className={`card px-4 py-4 ${className}`} style={style}>
      <p className="text-sm text-ink-muted">{t(label)}</p>
      {typeof amount === "number" ? (
        <AnimatedAmount value={amount} className="mt-1 block font-mono text-2xl font-semibold text-ink" />
      ) : (
        <p className="mt-1 font-mono text-2xl font-semibold text-ink">{value}</p>
      )}
      {detail ? <p className="text-xs text-ink-muted mt-1">{detail}</p> : null}
    </div>
  );
}
