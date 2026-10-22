import type { ReactNode } from "react";

/** Title and actions on one line, then the page. Matches a company tool, not a hero. */
export default function PageBar({
  title,
  note,
  actions,
}: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {note ? <p className="text-sm text-ink-muted mt-1 max-w-2xl">{note}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
