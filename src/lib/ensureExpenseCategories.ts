import { prisma } from "@/lib/prisma";

/** Job-cost categories offered on a new install. "Others" stays built in and is never a row. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Venue",
  "Staffing",
  "Transport",
  "Meals",
  "Equipment",
  "Materials",
  "Uniform",
  "Accommodation",
  "Subcontractor",
] as const;

export function categoryLabel(name: string): string {
  const trimmed = name.trim();
  const match = DEFAULT_EXPENSE_CATEGORIES.find((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (match) return match;
  if (trimmed.toLowerCase() === "others") return "Others";
  return trimmed;
}

/** Insert any missing starter categories. Existing names and old expense rows are left as they are. */
export async function ensureDefaultExpenseCategories() {
  const existing = await prisma.expenseCategory.findMany({
    select: { name: true, sortOrder: true },
  });
  const have = new Set(existing.map((row) => row.name.trim().toLowerCase()));
  const missing = DEFAULT_EXPENSE_CATEGORIES.filter((name) => !have.has(name.toLowerCase()));
  if (missing.length === 0) return;

  let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1);
  for (const name of missing) {
    sortOrder += 1;
    try {
      await prisma.expenseCategory.create({ data: { name, sortOrder } });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : "";
      if (code !== "P2002") throw error;
    }
  }
}
