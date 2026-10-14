import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SECTIONS, type SectionId } from "@/lib/sections";

export { SECTIONS, type SectionId } from "@/lib/sections";

const SECTION_IDS = new Set<string>(SECTIONS.map((section) => section.id));

export type AccountRecord = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  status: string;
  role: string;
  companyId: string | null;
  groupId: string | null;
  sections: string;
  company: { id: string; name: string; label: string; sections: string; isHome: boolean } | null;
  group: { id: string; number: number; sections: string } | null;
};

export function isSuper(account: { role: string; isAdmin: boolean }) {
  return account.role === "SUPER" || account.isAdmin;
}

export function isCompanyAdmin(account: { role: string; companyId: string | null; status: string }) {
  return account.role === "COMPANY_ADMIN" && !!account.companyId && account.status === "ACTIVE";
}

export function parseSections(raw: string | null | undefined): SectionId[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is SectionId => typeof id === "string" && SECTION_IDS.has(id));
  } catch {
    return [];
  }
}

/** "all" for the top admin and the original staff who have no company. */
export function allowedSections(account: AccountRecord): SectionId[] | "all" {
  if (isSuper(account)) return "all";
  if (!account.companyId && account.status === "ACTIVE") return "all";
  if (account.group) return parseSections(account.group.sections);
  return [];
}

export function canSeeSection(account: AccountRecord, section: SectionId) {
  const allowed = allowedSections(account);
  return allowed === "all" || allowed.includes(section);
}

export function sectionForPath(pathname: string): SectionId | "admin" | "company" | "settings" | "hr" | null {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/company")) return "company";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/hr")) return "hr";
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/bookings")) return "bookings";
  if (pathname.startsWith("/quotations/templates")) return "templates";
  if (pathname.startsWith("/quotations")) return "quotations";
  if (pathname.startsWith("/invoices")) return "invoices";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/receipts")) return "receipts";
  if (pathname.startsWith("/recruitment")) return "recruitment";
  if (pathname.startsWith("/clients")) return "clients";
  return null;
}

export async function getAccount(): Promise<AccountRecord | null> {
  const session = await getCurrentUser();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      company: { select: { id: true, name: true, label: true, sections: true, isHome: true } },
      group: { select: { id: true, number: true, sections: true } },
    },
  });
  if (!user) return null;
  if (user.isAdmin && user.role !== "SUPER") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "SUPER", status: "ACTIVE" },
    });
    user.role = "SUPER";
    user.status = "ACTIVE";
  }
  return user;
}

export type CompanyScope = { companyId: string } | { OR: { companyId: string | null }[] } | Record<string, never>;

/** HR Plus sees the original records and its own. Other companies see only their rows. */
export async function companyWhere(): Promise<CompanyScope> {
  const account = await getAccount();
  if (!account || !account.companyId || isSuper(account)) return {};
  if (account.company?.isHome) return { OR: [{ companyId: null }, { companyId: account.companyId }] };
  return { companyId: account.companyId };
}

export function rowInCompanyScope(scope: CompanyScope, companyId: string | null | undefined) {
  if ("OR" in scope) {
    return scope.OR.some((item) => (item.companyId == null ? !companyId : item.companyId === companyId));
  }
  if ("companyId" in scope) return companyId === scope.companyId;
  return true;
}

export async function ensureHomeCompany() {
  const existing = await prisma.company.findFirst({ where: { isHome: true } });
  if (existing) return existing;
  const byLabel = await prisma.company.findUnique({ where: { label: "HRPLUS" } });
  if (byLabel) {
    return prisma.company.update({ where: { id: byLabel.id }, data: { isHome: true } });
  }
  return prisma.company.create({ data: { name: "HR Plus", label: "HRPLUS", isHome: true } });
}

export async function uniqueCompanyLabel(name: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 18) || "CO";
  const taken = new Set((await prisma.company.findMany({ select: { label: true } })).map((company) => company.label));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const label = `${base}-${n}`.slice(0, 24);
    if (!taken.has(label)) return label;
  }
  return `CO-${Date.now().toString().slice(-6)}`;
}

export async function canSeeCompany(companyId: string | null | undefined) {
  const account = await getAccount();
  if (!account) return false;
  if (!account.companyId || isSuper(account)) return true;
  if (account.company?.isHome) return !companyId || companyId === account.companyId;
  return companyId === account.companyId;
}

export async function requireSectionApi(section: SectionId): Promise<NextResponse | null> {
  const account = await getAccount();
  if (!account || account.status !== "ACTIVE" || !canSeeSection(account, section)) {
    return NextResponse.json({ error: "You can't open this." }, { status: 403 });
  }
  return null;
}

export async function ownerCompanyId(): Promise<string | null> {
  const account = await getAccount();
  if (!account || isSuper(account)) return null;
  return account.companyId;
}
