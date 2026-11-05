"use client";

import CommissionStaffFilter from "@/components/CommissionStaffFilter";

export default function CommissionFilters({
  kind,
  state,
  when,
  paid,
  who,
  months,
  year,
  people,
  labels,
}: {
  kind: string;
  state: string;
  when: string;
  paid: string;
  who: string;
  months: string[];
  year: string;
  people: { code: string; nickname: string; name: string }[];
  labels: {
    type: string;
    status: string;
    when: string;
    payment: string;
    all: string;
    event: string;
    recruitment: string;
    pending: string;
    done: string;
    allTime: string;
    unpaid: string;
    paid: string;
    allStaff: string;
    search: string;
    empty: string;
  };
}) {
  return (
    <form
      action="/commission"
      method="get"
      className={`card grid gap-3 p-4 sm:grid-cols-2 ${people.length ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
      onChange={(event) => {
        if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
      }}
    >
      <label className="block text-xs text-ink-muted">
        {labels.type}
        <select name="kind" defaultValue={kind} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="">{labels.all}</option>
          <option value="event">{labels.event}</option>
          <option value="recruitment">{labels.recruitment}</option>
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        {labels.status}
        <select name="state" defaultValue={state} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="">{labels.all}</option>
          <option value="pending">{labels.pending}</option>
          <option value="done">{labels.done}</option>
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        {labels.when}
        <select name="when" defaultValue={when} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="">{labels.allTime}</option>
          {months.map((month) => (
            <option key={month} value={month}>{month}</option>
          ))}
          {[1, 2, 3, 4].map((quarter) => (
            <option key={quarter} value={`${year}-Q${quarter}`}>{`${year} Q${quarter}`}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-ink-muted">
        {labels.payment}
        <select name="paid" defaultValue={paid} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="">{labels.all}</option>
          <option value="unpaid">{labels.unpaid}</option>
          <option value="paid">{labels.paid}</option>
        </select>
      </label>
      {people.length ? (
      <div className="block text-xs text-ink-muted">
        {labels.allStaff}
        <div className="mt-1">
          <CommissionStaffFilter
            value={who}
            allLabel={labels.allStaff}
            searchLabel={labels.search}
            emptyLabel={labels.empty}
            people={people}
          />
        </div>
      </div>
      ) : null}
    </form>
  );
}
