import { prisma } from "@/lib/prisma";

// Accounts that always have every page, in addition to whoever is already
// marked isAdmin. They cannot be placed in a group.
export const FULL_ACCESS_EMAILS = ["lucasyam@hrplus.info", "atcheung@hrplus.info"];

export const ACCESS_PAGES = [
  { id: "dashboard", href: "/", label: "Dashboard" },
  { id: "bookings", href: "/bookings", label: "Bookings" },
  { id: "templates", href: "/quotations/templates", label: "Templates" },
  { id: "quotations", href: "/quotations", label: "Quotations" },
  { id: "invoices", href: "/invoices", label: "Invoices" },
  { id: "receipts", href: "/receipts", label: "Receipts" },
  { id: "expenses", href: "/expenses", label: "Expenses" },
  { id: "recruitment", href: "/recruitment", label: "Recruitment" },
  { id: "clients", href: "/clients", label: "Clients" },
  { id: "items", href: "/items", label: "Item library" },
  { id: "calendar", href: "/calendar", label: "Calendar" },
  { id: "analysis", href: "/analysis", label: "Analysis" },
  { id: "settings", href: "/settings", label: "Settings" },
  { id: "hr", href: "/hr", label: "HR System" },
] as const;

export type AccessPageId = (typeof ACCESS_PAGES)[number]["id"];

const PAGE_IDS = new Set<string>(ACCESS_PAGES.map((page) => page.id));

const PATH_RULES: { prefix: string; id: AccessPageId | "management" }[] = [
  { prefix: "/management", id: "management" },
  { prefix: "/quotations/templates", id: "templates" },
  { prefix: "/quotations", id: "quotations" },
  { prefix: "/invoices", id: "invoices" },
  { prefix: "/receipts", id: "receipts" },
  { prefix: "/expenses", id: "expenses" },
  { prefix: "/recruitment", id: "recruitment" },
  { prefix: "/bookings", id: "bookings" },
  { prefix: "/clients", id: "clients" },
  { prefix: "/items", id: "items" },
  { prefix: "/settings", id: "settings" },
  { prefix: "/calendar", id: "calendar" },
  { prefix: "/analysis", id: "analysis" },
  { prefix: "/hr", id: "hr" },
];

export type AccessGroupRecord = {
  id: string;
  name: string;
  pages: string[];
  emails: string[];
};

export type AccessPerson = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSuperAdmin(user: { email: string; isAdmin?: boolean }): boolean {
  if (user.isAdmin) return true;
  return FULL_ACCESS_EMAILS.includes(normalizeEmail(user.email));
}

export function pageIdForPath(pathname: string): AccessPageId | "management" | null {
  if (pathname === "/") return "dashboard";
  for (const rule of PATH_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) return rule.id;
  }
  return null;
}

export function pagesForPerson(
  user: { email: string; isAdmin?: boolean },
  groups: AccessGroupRecord[]
): "all" | string[] {
  if (isSuperAdmin(user)) return "all";
  const email = normalizeEmail(user.email);
  const mine = groups.filter((group) => group.emails.includes(email));
  if (mine.length === 0) return "all";
  const ids = new Set<string>();
  for (const group of mine) {
    for (const page of group.pages) ids.add(page);
  }
  return Array.from(ids);
}

export function canOpenPath(pathname: string, pages: "all" | string[], superAdmin: boolean): boolean {
  const id = pageIdForPath(pathname);
  if (id === "management") return superAdmin;
  if (id === null || pages === "all") return true;
  return pages.includes(id);
}

export function firstAllowedHref(pages: "all" | string[]): string | null {
  if (pages === "all") return "/";
  for (const page of ACCESS_PAGES) {
    if (pages.includes(page.id)) return page.href;
  }
  return null;
}

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function listAccessGroups(): Promise<{ groups: AccessGroupRecord[]; ready: boolean }> {
  try {
    const rows = await prisma.accessGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return {
      ready: true,
      groups: rows.map((row) => ({
        id: row.id,
        name: row.name,
        pages: parseStringList(row.pages).filter((id) => PAGE_IDS.has(id)),
        emails: parseStringList(row.emails).map(normalizeEmail),
      })),
    };
  } catch (err) {
    console.error("listAccessGroups failed, leaving everyone on full access:", err);
    return { groups: [], ready: false };
  }
}

export function sanitizeGroups(input: unknown, people: AccessPerson[]): AccessGroupRecord[] {
  if (!Array.isArray(input)) return [];
  const knownEmails = new Set(
    people.filter((person) => !isSuperAdmin(person)).map((person) => normalizeEmail(person.email))
  );
  const usedEmails = new Set<string>();
  const groups: AccessGroupRecord[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; name?: unknown; pages?: unknown; emails?: unknown };
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 40) : "";
    if (!name) continue;
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "";
    if (!id) continue;
    const pages = Array.isArray(record.pages)
      ? Array.from(new Set(record.pages.filter((page): page is string => typeof page === "string" && PAGE_IDS.has(page))))
      : [];
    const emails: string[] = [];
    if (Array.isArray(record.emails)) {
      for (const email of record.emails) {
        if (typeof email !== "string") continue;
        const normalized = normalizeEmail(email);
        if (!knownEmails.has(normalized) || usedEmails.has(normalized)) continue;
        usedEmails.add(normalized);
        emails.push(normalized);
      }
    }
    groups.push({ id, name, pages, emails });
  }
  return groups;
}

export async function replaceAccessGroups(groups: AccessGroupRecord[]): Promise<{ ok: true } | { ok: false; missing: boolean }> {
  try {
    await prisma.$transaction([
      prisma.accessGroup.deleteMany(),
      ...groups.map((group, index) =>
        prisma.accessGroup.create({
          data: {
            id: group.id,
            name: group.name,
            pages: JSON.stringify(group.pages),
            emails: JSON.stringify(group.emails),
            sortOrder: index,
          },
        })
      ),
    ]);
    return { ok: true };
  } catch (err) {
    console.error("replaceAccessGroups failed:", err);
    return { ok: false, missing: true };
  }
}
