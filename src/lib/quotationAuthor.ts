import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Nicknames (and staff names) offered when picking who a quotation share goes to. */
export async function loadColleagueNames(): Promise<string[]> {
  const [users, employees] = await Promise.all([
    prisma.user.findMany({ select: { nickname: true, name: true } }),
    prisma.employee.findMany({
      where: { status: { not: "FORMER" }, nickname: { not: null } },
      select: { nickname: true },
    }),
  ]);
  const names = new Set<string>();
  for (const user of users) {
    if (user.nickname.trim()) names.add(user.nickname.trim());
    else if (user.name.trim()) names.add(user.name.trim());
  }
  for (const employee of employees) {
    if (employee.nickname?.trim()) names.add(employee.nickname.trim());
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/**
 * Nickname stamped onto a new quotation. The login account's nickname wins;
 * if that's blank, use the employee record whose company email matches the login.
 */
export async function loadCurrentNickname(): Promise<string> {
  const session = await getCurrentUser();
  if (!session) return "";
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { nickname: true, email: true },
  });
  if (user?.nickname.trim()) return user.nickname.trim();
  const email = user?.email || session.email;
  if (!email) return "";
  const employee = await prisma.employee.findFirst({
    where: { companyEmail: { equals: email, mode: "insensitive" }, nickname: { not: null } },
    select: { nickname: true },
  });
  return employee?.nickname?.trim() || "";
}
