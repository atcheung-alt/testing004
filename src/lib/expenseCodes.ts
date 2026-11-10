export type ExpenseCodeRow = { id: string; source: "invoice" | "general"; date: string };

/** Same EX-YYYY-#### sequence the Expenses page shows, oldest first within a year. */
export function expenseCodes(rows: ExpenseCodeRow[]) {
  const byYear = new Map<string, ExpenseCodeRow[]>();
  for (const row of rows) {
    const year = row.date.slice(0, 4) || "0000";
    const list = byYear.get(year) || [];
    list.push(row);
    byYear.set(year, list);
  }
  const codes = new Map<string, string>();
  for (const [year, list] of byYear) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
    sorted.forEach((row, index) => {
      codes.set(`${row.source}-${row.id}`, `EX-${year}-${String(index + 1).padStart(4, "0")}`);
    });
  }
  return codes;
}
