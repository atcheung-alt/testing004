import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/accessControl";

// Stored in the existing AccessGroup row. No new table and no new column.
export const ACCESS_REQUESTS_ROW_ID = "access_requests";

export type AccessRequest = {
  id: string;
  email: string;
  name: string;
  companyName: string;
  note: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

function parseRequests(raw: string | null | undefined): AccessRequest[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { requests?: unknown };
    if (!parsed || !Array.isArray(parsed.requests)) return [];
    const requests: AccessRequest[] = [];
    for (const item of parsed.requests) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<AccessRequest>;
      if (typeof row.email !== "string" || !row.email.trim()) continue;
      if (typeof row.id !== "string" || !row.id) continue;
      const status = row.status === "APPROVED" || row.status === "REJECTED" ? row.status : "PENDING";
      requests.push({
        id: row.id,
        email: normalizeEmail(row.email),
        name: typeof row.name === "string" ? row.name.slice(0, 80) : "",
        companyName: typeof row.companyName === "string" ? row.companyName.slice(0, 120) : "",
        note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        status,
      });
    }
    return requests;
  } catch {
    return [];
  }
}

async function readAll(): Promise<AccessRequest[]> {
  try {
    const row = await prisma.accessGroup.findUnique({ where: { id: ACCESS_REQUESTS_ROW_ID } });
    return parseRequests(row?.pages);
  } catch (err) {
    console.error("readAccessRequests failed:", err);
    return [];
  }
}

async function writeAll(requests: AccessRequest[]): Promise<boolean> {
  try {
    await prisma.accessGroup.upsert({
      where: { id: ACCESS_REQUESTS_ROW_ID },
      create: {
        id: ACCESS_REQUESTS_ROW_ID,
        name: "Access requests",
        pages: JSON.stringify({ requests }),
        emails: "[]",
        sortOrder: 10002,
      },
      update: { pages: JSON.stringify({ requests }), name: "Access requests" },
    });
    return true;
  } catch (err) {
    console.error("writeAccessRequests failed:", err);
    return false;
  }
}

export async function listPendingAccessRequests(): Promise<AccessRequest[]> {
  const requests = await readAll();
  return requests.filter((request) => request.status === "PENDING").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function submitAccessRequest(input: {
  email: string;
  name: string;
  companyName: string;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "That doesn't look like a valid email address." };
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) return { ok: false, error: "That email already has access. Sign in with Google." };

  const requests = await readAll();
  const pending = requests.find((request) => request.email === email && request.status === "PENDING");
  const next: AccessRequest = {
    id: pending?.id || `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: input.name.trim().slice(0, 80),
    companyName: input.companyName.trim().slice(0, 120),
    note: input.note.trim().slice(0, 500),
    createdAt: pending?.createdAt || new Date().toISOString(),
    status: "PENDING",
  };
  const rest = requests.filter((request) => request.id !== next.id && !(request.email === email && request.status === "REJECTED"));
  const saved = await writeAll([next, ...rest].slice(0, 200));
  if (!saved) return { ok: false, error: "Could not save the request." };
  return { ok: true };
}

export async function findAccessRequest(id: string): Promise<AccessRequest | null> {
  return (await readAll()).find((request) => request.id === id) || null;
}

export async function setAccessRequestStatus(id: string, status: "APPROVED" | "REJECTED"): Promise<void> {
  const requests = await readAll();
  await writeAll(requests.map((request) => (request.id === id ? { ...request, status } : request)));
}
