import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Accounts that always have every page, in addition to whoever is already
// marked isAdmin. They cannot be placed in a group.
export const FULL_ACCESS_EMAILS = [
  "atcheung@hrplus.info",
  "atchung@hrplus.info",
  "contact@hrplus.info",
];
export const ADMIN_GROUP_ID = "group_admin";
export const FULL_GROUP_ID = "group_full";

export const ACCESS_PAGES = [
  { id: "dashboard", href: "/", label: "Dashboard" },
  { id: "bookings", href: "/bookings", label: "Bookings" },
  { id: "templates", href: "/quotations/templates", label: "Templates" },
  { id: "quotations", href: "/quotations", label: "Quotations" },
  { id: "invoices", href: "/invoices", label: "Invoices" },
  { id: "receipts", href: "/receipts", label: "Receipts" },
  { id: "expenses", href: "/expenses", label: "Expenses" },
  { id: "recruitment", href: "/recruitment", label: "Recruitment" },
  { id: "massage", href: "/massage", label: "Massage" },
  { id: "clients", href: "/clients", label: "Clients" },
  { id: "items", href: "/items", label: "Item Library" },
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
  { prefix: "/massage", id: "massage" },
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

export function allAccessPageIds(): string[] {
  return ACCESS_PAGES.map((page) => page.id);
}

export function placeEveryone(groups: AccessGroupRecord[], people: AccessPerson[]): AccessGroupRecord[] {
  const supers = people.filter((person) => isSuperAdmin(person)).map((person) => normalizeEmail(person.email));
  const superSet = new Set(supers);
  const others = people
    .map((person) => normalizeEmail(person.email))
    .filter((email) => !superSet.has(email));
  const otherSet = new Set(others);
  const savedFull = groups.find((group) => group.id === FULL_GROUP_ID);
  const savedAdmin = groups.find((group) => group.id === ADMIN_GROUP_ID);
  const assigned = new Set<string>();
  const custom = groups
    .filter((group) => group.id !== ADMIN_GROUP_ID && group.id !== FULL_GROUP_ID)
    .map((group) => {
      const emails = group.emails.filter((email) => otherSet.has(email) && !assigned.has(email));
      emails.forEach((email) => assigned.add(email));
      return { ...group, emails };
    });
  const fullEmails = others.filter((email) => !assigned.has(email));
  return [
    {
      id: ADMIN_GROUP_ID,
      name: savedAdmin?.name.trim() || "Admin",
      pages: allAccessPageIds(),
      emails: supers,
    },
    {
      id: FULL_GROUP_ID,
      name: savedFull?.name.trim() || "Full access",
      pages: savedFull ? savedFull.pages : allAccessPageIds(),
      emails: fullEmails,
    },
    ...custom,
  ];
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

const RESERVED_ACCESS_ROW_IDS = new Set([
  "staff_profiles",
  "client_service_terms",
  "access_requests",
  "work_timesheets",
]);

function readGroups(rows: { id: string; name: string; pages: string; emails: string }[]): AccessGroupRecord[] {
  return rows.filter((row) => !RESERVED_ACCESS_ROW_IDS.has(row.id)).map((row) => ({
    id: row.id,
    name: row.name,
    pages: parseStringList(row.pages).filter((id) => PAGE_IDS.has(id)),
    emails: parseStringList(row.emails).map(normalizeEmail),
  }));
}

// The group list lives in its own empty table. Creating it does not alter any
// existing table. This runs only when that table is missing, using the direct
// database connection so the pooler does not reject the statement.
async function ensureAccessGroupTable(): Promise<boolean> {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) return false;
  const direct = new PrismaClient({ datasources: { db: { url: connectionString } } });
  try {
    await direct.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AccessGroup" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "pages" TEXT NOT NULL DEFAULT '[]',
        "emails" TEXT NOT NULL DEFAULT '[]',
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "AccessGroup_pkey" PRIMARY KEY ("id")
      )
    `);
    return true;
  } catch (err) {
    console.error("ensureAccessGroupTable failed:", err);
    return false;
  } finally {
    await direct.$disconnect().catch(() => undefined);
  }
}

export async function listAccessGroups(): Promise<{ groups: AccessGroupRecord[]; ready: boolean }> {
  try {
    const rows = await prisma.accessGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return { ready: true, groups: readGroups(rows) };
  } catch (err) {
    console.error("listAccessGroups failed, leaving everyone on full access:", err);
    const created = await ensureAccessGroupTable();
    if (!created) return { groups: [], ready: false };
    try {
      const rows = await prisma.accessGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      return { ready: true, groups: readGroups(rows) };
    } catch (retryErr) {
      console.error("listAccessGroups still failed after creating the group table:", retryErr);
      return { groups: [], ready: false };
    }
  }
}

export function sanitizeGroups(input: unknown, people: AccessPerson[]): AccessGroupRecord[] {
  if (!Array.isArray(input)) return placeEveryone([], people);
  const knownEmails = new Set(people.map((person) => normalizeEmail(person.email)));
  const groups: AccessGroupRecord[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; name?: unknown; pages?: unknown; emails?: unknown };
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 40) : "";
    if (!name) continue;
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "";
    if (!id || RESERVED_ACCESS_ROW_IDS.has(id)) continue;
    const pages = Array.isArray(record.pages)
      ? Array.from(new Set(record.pages.filter((page): page is string => typeof page === "string" && PAGE_IDS.has(page))))
      : [];
    const emails: string[] = [];
    if (Array.isArray(record.emails)) {
      for (const email of record.emails) {
        if (typeof email !== "string") continue;
        const normalized = normalizeEmail(email);
        if (!knownEmails.has(normalized)) continue;
        emails.push(normalized);
      }
    }
    groups.push({ id, name, pages, emails });
  }
  return placeEveryone(groups, people);
}

function groupSignature(groups: AccessGroupRecord[]): string {
  return JSON.stringify(
    groups.map((group) => ({
      id: group.id,
      name: group.name,
      pages: [...group.pages].sort(),
      emails: [...group.emails].sort(),
    }))
  );
}

export async function loadAccessGroups(): Promise<{ groups: AccessGroupRecord[]; ready: boolean }> {
  const stored = await listAccessGroups();
  if (!stored.ready) return stored;
  const people = await prisma.user.findMany({
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  const placed = placeEveryone(stored.groups, people);
  if (groupSignature(placed) === groupSignature(stored.groups)) return { groups: placed, ready: true };
  const saved = await replaceAccessGroups(placed);
  if (!saved.ok) return { groups: stored.groups, ready: true };
  return { groups: placed, ready: true };
}

export async function replaceAccessGroups(groups: AccessGroupRecord[]): Promise<{ ok: true } | { ok: false; missing: boolean }> {
  try {
    await prisma.$transaction([
      prisma.accessGroup.deleteMany({ where: { id: { notIn: Array.from(RESERVED_ACCESS_ROW_IDS) } } }),
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
