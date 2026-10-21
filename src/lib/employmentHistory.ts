import { prisma } from "@/lib/prisma";

const historySelect = {
  id: true,
  name: true,
  nickname: true,
  title: true,
  status: true,
  startDate: true,
  lastDay: true,
  leavingReason: true,
  priorEmployeeId: true,
  company: { select: { id: true, name: true } },
} as const;

export type EmploymentHistoryEntry = {
  id: string;
  name: string;
  nickname: string | null;
  title: string;
  status: string;
  startDate: Date | null;
  lastDay: Date | null;
  leavingReason: string | null;
  companyName: string | null;
};

/**
 * Every employment stint for this person, oldest first. A rejoin creates a
 * new employee row linked by priorEmployeeId, so the old FORMER record and
 * the new one both stay on file.
 */
export async function loadEmploymentHistory(employeeId: string): Promise<EmploymentHistoryEntry[]> {
  const chain: EmploymentHistoryEntry[] = [];
  const seen = new Set<string>();

  let cursorId: string | null = employeeId;
  const backward: EmploymentHistoryEntry[] = [];
  while (cursorId && !seen.has(cursorId)) {
    const row: {
      id: string;
      name: string;
      nickname: string | null;
      title: string;
      status: string;
      startDate: Date | null;
      lastDay: Date | null;
      leavingReason: string | null;
      priorEmployeeId: string | null;
      company: { id: string; name: string } | null;
    } | null = await prisma.employee.findUnique({
      where: { id: cursorId },
      select: historySelect,
    });
    if (!row) break;
    seen.add(row.id);
    backward.unshift({
      id: row.id,
      name: row.name,
      nickname: row.nickname,
      title: row.title,
      status: row.status,
      startDate: row.startDate,
      lastDay: row.lastDay,
      leavingReason: row.leavingReason,
      companyName: row.company?.name || null,
    });
    cursorId = row.priorEmployeeId;
  }

  chain.push(...backward);

  let tailId = chain[chain.length - 1]?.id;
  while (tailId) {
    const next: {
      id: string;
      name: string;
      nickname: string | null;
      title: string;
      status: string;
      startDate: Date | null;
      lastDay: Date | null;
      leavingReason: string | null;
      priorEmployeeId: string | null;
      company: { id: string; name: string } | null;
    } | null = await prisma.employee.findFirst({
      where: { priorEmployeeId: tailId },
      select: historySelect,
    });
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    chain.push({
      id: next.id,
      name: next.name,
      nickname: next.nickname,
      title: next.title,
      status: next.status,
      startDate: next.startDate,
      lastDay: next.lastDay,
      leavingReason: next.leavingReason,
      companyName: next.company?.name || null,
    });
    tailId = next.id;
  }

  return chain;
}
