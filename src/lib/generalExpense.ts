import { prisma } from "@/lib/prisma";

export type GeneralExpenseRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  spentAt: Date;
  vendor: string;
  notes: string;
  invoiceId: string;
  invoiceNumber: string;
  fileName: string;
  mimeType: string;
  createdBy: string;
};

/** Create the general-expense table when this database does not have it yet. Existing rows are left in place. */
export async function ensureGeneralExpenseTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GeneralExpense" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Others',
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "spentAt" TIMESTAMP(3) NOT NULL,
      "vendor" TEXT NOT NULL DEFAULT '',
      "notes" TEXT NOT NULL DEFAULT '',
      "invoiceId" TEXT,
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "fileName" TEXT NOT NULL DEFAULT '',
      "mimeType" TEXT NOT NULL DEFAULT '',
      "fileData" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expenseType" TEXT NOT NULL DEFAULT 'GENERAL',
      "createdBy" TEXT NOT NULL DEFAULT ''
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GeneralExpense_spentAt_idx" ON "GeneralExpense"("spentAt")`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "GeneralExpense" ALTER COLUMN "invoiceId" DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "GeneralExpense" ADD COLUMN IF NOT EXISTS "expenseType" TEXT NOT NULL DEFAULT 'GENERAL'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "GeneralExpense" ADD COLUMN IF NOT EXISTS "createdBy" TEXT NOT NULL DEFAULT ''`);
}

export async function ensureInvoiceExpenseOwnerColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE "InvoiceExpense" ADD COLUMN IF NOT EXISTS "createdBy" TEXT NOT NULL DEFAULT ''`);
}

const lightSelect = {
  id: true,
  name: true,
  category: true,
  amount: true,
  spentAt: true,
  vendor: true,
  notes: true,
  invoiceId: true,
  invoiceNumber: true,
  fileName: true,
  mimeType: true,
  createdBy: true,
} as const;

export async function listGeneralExpenses(): Promise<GeneralExpenseRow[]> {
  try {
    const rows = await prisma.generalExpense.findMany({
      orderBy: { spentAt: "desc" },
      take: 300,
      select: lightSelect,
    });
    return rows.map((row) => ({ ...row, invoiceId: row.invoiceId || "" }));
  } catch {
    return [];
  }
}

export async function generalExpensesBetween(start: Date, end: Date): Promise<{ amount: number; category: string; spentAt: Date }[]> {
  try {
    return await prisma.generalExpense.findMany({
      where: { spentAt: { gte: start, lt: end } },
      select: { amount: true, category: true, spentAt: true },
    });
  } catch {
    return [];
  }
}

export async function sumGeneralExpenses(): Promise<number> {
  try {
    const total = await prisma.generalExpense.aggregate({ _sum: { amount: true } });
    return total._sum.amount || 0;
  } catch {
    return 0;
  }
}
