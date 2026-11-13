import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; recordColumns?: Promise<void> };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Add the signed-record columns once, on a separate connection. */
export function ensureRecordColumns() {
  if (!globalForPrisma.recordColumns) {
    globalForPrisma.recordColumns = (async () => {
      const ddl = new PrismaClient();
      try {
        await ddl.$executeRawUnsafe(`ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT NOT NULL DEFAULT ''`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT NOT NULL DEFAULT ''`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recordFileId" TEXT`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recordFileUrl" TEXT`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recordFileName" TEXT`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT NOT NULL DEFAULT ''`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "recordFileId" TEXT`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "recordFileUrl" TEXT`);
        await ddl.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "recordFileName" TEXT`);
      } finally {
        await ddl.$disconnect();
      }
    })().catch((error) => {
      globalForPrisma.recordColumns = undefined;
      throw error;
    });
  }
  return globalForPrisma.recordColumns;
}
