import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/calculations";

// Stored in the existing AccessGroup row `client_service_terms`. No new table
// and no new column. This is the service charge each client company pays on
// top of wages and employer MPF.
export const CLIENT_SERVICE_ROW_ID = "client_service_terms";

export const FEE_MODES = ["PER_HEAD", "PERCENT", "FLAT"] as const;
export type FeeMode = (typeof FEE_MODES)[number];

export type ClientTerm = {
  companyId: string;
  feeMode: FeeMode;
  feeValue: number;
};

export type ClientBill = {
  runId: string;
  companyId: string;
  invoiceId: string;
};

type Store = {
  terms: ClientTerm[];
  bills: ClientBill[];
};

const EMPTY: Store = { terms: [], bills: [] };

function asMode(value: unknown): FeeMode {
  return FEE_MODES.includes(value as FeeMode) ? (value as FeeMode) : "PER_HEAD";
}

function asMoney(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return round2(number);
}

function parseStore(raw: string | null | undefined): Store {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as { terms?: unknown; bills?: unknown };
    if (!parsed || Array.isArray(parsed)) return EMPTY;
    const terms: ClientTerm[] = [];
    if (Array.isArray(parsed.terms)) {
      for (const item of parsed.terms) {
        if (!item || typeof item !== "object") continue;
        const row = item as { companyId?: unknown; feeMode?: unknown; feeValue?: unknown };
        if (typeof row.companyId !== "string" || !row.companyId) continue;
        terms.push({ companyId: row.companyId, feeMode: asMode(row.feeMode), feeValue: asMoney(row.feeValue) });
      }
    }
    const bills: ClientBill[] = [];
    if (Array.isArray(parsed.bills)) {
      for (const item of parsed.bills) {
        if (!item || typeof item !== "object") continue;
        const row = item as { runId?: unknown; companyId?: unknown; invoiceId?: unknown };
        if (typeof row.runId !== "string" || typeof row.companyId !== "string" || typeof row.invoiceId !== "string") continue;
        bills.push({ runId: row.runId, companyId: row.companyId, invoiceId: row.invoiceId });
      }
    }
    return { terms, bills };
  } catch {
    return EMPTY;
  }
}

async function readStore(): Promise<Store> {
  try {
    const row = await prisma.accessGroup.findUnique({ where: { id: CLIENT_SERVICE_ROW_ID } });
    return parseStore(row?.pages);
  } catch (err) {
    console.error("readClientService failed:", err);
    return EMPTY;
  }
}

async function writeStore(store: Store): Promise<boolean> {
  try {
    await prisma.accessGroup.upsert({
      where: { id: CLIENT_SERVICE_ROW_ID },
      create: {
        id: CLIENT_SERVICE_ROW_ID,
        name: "Client service terms",
        pages: JSON.stringify(store),
        emails: "[]",
        sortOrder: 10001,
      },
      update: { pages: JSON.stringify(store), name: "Client service terms" },
    });
    return true;
  } catch (err) {
    console.error("writeClientService failed:", err);
    return false;
  }
}

export async function readClientTerms(): Promise<ClientTerm[]> {
  return (await readStore()).terms;
}

export function termFor(terms: ClientTerm[], companyId: string): ClientTerm {
  return terms.find((term) => term.companyId === companyId) || { companyId, feeMode: "PER_HEAD", feeValue: 0 };
}

export function serviceFeeFor(term: ClientTerm, headcount: number, gross: number): number {
  if (term.feeMode === "PERCENT") return round2((gross * term.feeValue) / 100);
  if (term.feeMode === "FLAT") return round2(term.feeValue);
  return round2(term.feeValue * headcount);
}

export async function saveClientTerm(companyId: string, feeMode: unknown, feeValue: unknown): Promise<ClientTerm> {
  const store = await readStore();
  const next: ClientTerm = { companyId, feeMode: asMode(feeMode), feeValue: asMoney(feeValue) };
  const terms = store.terms.filter((term) => term.companyId !== companyId);
  terms.push(next);
  await writeStore({ ...store, terms });
  return next;
}

export async function removeClientTerm(companyId: string): Promise<void> {
  const store = await readStore();
  await writeStore({
    terms: store.terms.filter((term) => term.companyId !== companyId),
    bills: store.bills.filter((bill) => bill.companyId !== companyId),
  });
}

export async function findClientBill(runId: string, companyId: string): Promise<ClientBill | null> {
  const store = await readStore();
  return store.bills.find((bill) => bill.runId === runId && bill.companyId === companyId) || null;
}

export async function rememberClientBill(bill: ClientBill): Promise<void> {
  const store = await readStore();
  const bills = store.bills.filter((item) => !(item.runId === bill.runId && item.companyId === bill.companyId));
  bills.push(bill);
  await writeStore({ ...store, bills });
}
