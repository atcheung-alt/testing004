import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { staffCodeFromId, type StaffColleague } from "@/lib/staffCode";
import type { QuotationShareInput } from "@/lib/quotationShares";

/** Login accounts, shown by nickname. The value saved on a share is the staff number. */
export async function loadColleagues(): Promise<StaffColleague[]> {
  const users = await prisma.user.findMany({
    select: { id: true, nickname: true, name: true, email: true },
    orderBy: { email: "asc" },
  });
  return users
    .map((user) => ({
      code: staffCodeFromId(user.id),
      nickname: user.nickname.trim() || user.name.trim() || user.email,
      name: user.name.trim(),
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
}

/** Rewrite a typed nickname to that person's staff number. Unknown names stay as typed. */
export async function bindShareColleagueNames(shares: QuotationShareInput[]): Promise<QuotationShareInput[]> {
  if (shares.length === 0) return shares;
  const users = await prisma.user.findMany({ select: { id: true, nickname: true, name: true } });
  return shares.map((share) => {
    const named = share.colleagueName.trim().toLowerCase();
    const hit = users.find((user) => {
      const code = staffCodeFromId(user.id);
      return (
        code === share.colleagueName.trim() ||
        (user.nickname.trim() && user.nickname.trim().toLowerCase() === named) ||
        (user.name.trim() && user.name.trim().toLowerCase() === named)
      );
    });
    return hit ? { ...share, colleagueName: staffCodeFromId(hit.id) } : share;
  });
}

/**
 * Nickname stamped onto a new quotation. The login account's nickname wins;
 * if that's blank, use the employee record whose company email matches the login.
 */
/** Nickname of the account that created the document. System events have none. */
export async function loadCreatorNickname(
  documentType: "invoice" | "quotation",
  documentId: string
): Promise<string> {
  const event = await prisma.activityEvent.findFirst({
    where: { documentType, documentId, type: "CREATED", actor: "STAFF" },
    orderBy: { createdAt: "asc" },
    select: { actorName: true },
  });
  const actorName = event?.actorName || "";
  if (!actorName) return "";
  const code = actorName.match(/#(\d{8})\b/)?.[1];
  const email = actorName.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const users = await prisma.user.findMany({ select: { id: true, nickname: true, name: true, email: true } });
  const hit = users.find(
    (user) =>
      (code && staffCodeFromId(user.id) === code) ||
      (email && user.email.toLowerCase() === email.toLowerCase())
  );
  if (!hit) return "";
  return hit.nickname.trim() || hit.name.trim();
}

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
