import type { ReactNode } from "react";
import BackButton from "@/components/BackButton";

/** Detail title row. Back returns to the list the user opened this record from. */
export default function PageBackHeader({
  backLabel,
  fallbackRoute,
  title,
  status,
  meta,
  actions,
}: {
  backLabel: string;
  fallbackRoute: string;
  title: string;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div>
      <BackButton fallbackHref={fallbackRoute} label={backLabel} listRoute={fallbackRoute} />
      <div className="flex flex-wrap items-start justify-between gap-4 mt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
            {status}
          </div>
          {meta}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 items-start sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
