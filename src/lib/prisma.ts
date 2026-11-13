import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof buildPrisma> };

function buildPrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  let ready: Promise<void> | null = null;
  let columnsReady = false;
  function ensureRecordColumns() {
    if (columnsReady) return Promise.resolve();
    if (!ready) {
      ready = (async () => {
        await base.$executeRawUnsafe(`ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT NOT NULL DEFAULT ''`);
        await base.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT NOT NULL DEFAULT ''`);
        await base.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recordFileId" TEXT`);
        await base.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recordFileUrl" TEXT`);
        await base.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recordFileName" TEXT`);
        await base.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT NOT NULL DEFAULT ''`);
        await base.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "recordFileId" TEXT`);
        await base.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "recordFileUrl" TEXT`);
        await base.$executeRawUnsafe(`ALTER TABLE "RecruitmentAgreement" ADD COLUMN IF NOT EXISTS "recordFileName" TEXT`);
        columnsReady = true;
      })().catch((error) => {
        ready = null;
        throw error;
      });
    }
    return ready;
  }
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          if (!columnsReady) await ensureRecordColumns();
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
