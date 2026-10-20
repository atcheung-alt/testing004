import Link from "next/link";
import { LucideIcon } from "lucide-react";

export default function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="border-t-2 border-ink px-1 py-5">
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-ink-muted max-w-md mb-4">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
