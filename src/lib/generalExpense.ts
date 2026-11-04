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
};

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
} as const;

export async function listGeneralExpenses(): Promise<GeneralExpenseRow[]> {
  try {
    return await prisma.generalExpense.findMany({
      orderBy: { spentAt: "desc" },
      take: 300,
      select: lightSelect,
    });
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
