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
    <div className="page-bar flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-4">
      <div className="min-w-0">
        <h1 className="font-sans text-lg font-semibold text-ink">{title}</h1>
        {note ? <p className="text-sm text-ink-muted mt-0.5 max-w-2xl">{note}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
