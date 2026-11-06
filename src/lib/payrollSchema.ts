import { prisma } from "@/lib/prisma";

/** Adds the optional payroll-run label. Existing rows stay, with an empty name. */
export async function ensurePayrollRunName() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "name" TEXT`);
}
