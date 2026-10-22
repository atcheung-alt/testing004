import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin, normalizeEmail } from "@/lib/accessControl";
import { profileFor, readStaffDirectory, type StaffProfile } from "@/lib/staffDirectory";
import { staffCodeFromId } from "@/lib/staffCode";
import { SHARE_HOLDER_PREFIX } from "@/lib/quotationShares";

type Person = {
  email: string;
  nickname: string;
  name: string;
  code: string;
  joinedAt: Date;
};

type AccessMode = { mode: "all" } | { mode: "none" } | { mode: "self"; person: Person };

function emailsInText(value: string | null | undefined): string[] {
  if (!value) return [];
  return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.toLowerCase());
}

function actorOwns(actorName: string | null | undefined, person: Person): boolean {
  if (!actorName) return false;
  if (actorName.includes(`#${person.code}`)) return true;
  if (emailsInText(actorName).includes(person.email)) return true;
  return actorName.trim().toLowerCase() === person.email;
}

function shareHits(colleagueName: string, person: Person): boolean {
  const named = colleagueName.trim().toLowerCase();
  if (!named) return false;
  if (named === person.code) return true;
  if (person.nickname && named === person.nickname.toLowerCase()) return true;
  if (person.name && named === person.name.toLowerCase()) return true;
  return false;
}

async function currentAccess(): Promise<AccessMode> {
  const session = await getCurrentUser();
  if (!session) return { mode: "none" };
  if (session.isAdmin || isSuperAdmin(session)) return { mode: "all" };
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, nickname: true, name: true, isAdmin: true, createdAt: true },
  });
  if (!user || user.isAdmin) return user?.isAdmin ? { mode: "all" } : { mode: "none" };
  return {
    mode: "self",
    person: {
      email: normalizeEmail(user.email),
      nickname: user.nickname.trim(),
      name: user.name.trim(),
      code: staffCodeFromId(user.id),
      joinedAt: user.createdAt,
    },
  };
}

async function quotationAccess(person: Person) {
  const directory = await readStaffDirectory();
  const created = await prisma.activityEvent.findMany({
    where: { documentType: "quotation", type: "CREATED" },
    select: { documentId: true, actorName: true },
  });
  const createdIds = created.filter((event) => actorOwns(event.actorName, person)).map((event) => event.documentId);
  const ownedRows = createdIds.length
    ? await prisma.quotation.findMany({
        where: { id: { in: createdIds }, createdAt: { gte: person.joinedAt } },
        select: { id: true },
      })
    : [];
  const shares = await prisma.quotationShare.findMany({
    select: { quotationId: true, colleagueName: true },
  });
  const sharedQuoteIds = shares.filter((share) => shareHits(share.colleagueName, person)).map((share) => share.quotationId);
  const granted = directory.grants
    .filter((grant) => grant.documentType === "quotation" && grant.emails.includes(person.email))
    .map((grant) => grant.documentId);
  const editIds = new Set(ownedRows.map((row) => row.id));
  const viewIds = new Set<string>([...editIds, ...sharedQuoteIds, ...granted]);
  return { editIds, viewIds, sharedQuoteIds };
}

async function invoiceAccess(person: Person) {
  const directory = await readStaffDirectory();
  const quotes = await quotationAccess(person);
  const created = await prisma.activityEvent.findMany({
    where: { documentType: "invoice", type: "CREATED" },
    select: { documentId: true, actorName: true },
  });
  const createdIds = created.filter((event) => actorOwns(event.actorName, person)).map((event) => event.documentId);
  const ownedDirect = createdIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: createdIds }, createdAt: { gte: person.joinedAt } },
        select: { id: true },
      })
    : [];
  const fromOwnedQuotes = quotes.editIds.size
    ? await prisma.invoice.findMany({
        where: { quotationId: { in: Array.from(quotes.editIds) } },
        select: { id: true },
      })
    : [];
  const fromShares = quotes.sharedQuoteIds.length
    ? await prisma.invoice.findMany({
        where: { quotationId: { in: quotes.sharedQuoteIds } },
        select: { id: true },
      })
    : [];
  const grantedIds = directory.grants
    .filter((grant) => grant.documentType === "invoice" && grant.emails.includes(person.email))
    .map((grant) => grant.documentId);
  const grantedRows = grantedIds.length
    ? await prisma.invoice.findMany({ where: { id: { in: grantedIds } }, select: { id: true } })
    : [];
  const editIds = new Set([...ownedDirect, ...fromOwnedQuotes].map((row) => row.id));
  const viewIds = new Set<string>([...editIds, ...fromShares.map((row) => row.id), ...grantedRows.map((row) => row.id)]);
  return { editIds, viewIds };
}

function idFilter(ids: Set<string>): Record<string, unknown> {
  return { id: { in: Array.from(ids) } };
}

async function passes(model: "quotation" | "invoice" | "quotationTemplate", id: string, ids: Set<string> | null) {
  if (!ids) return true;
  if (!ids.has(id)) return false;
  if (model === "quotationTemplate") {
    const row = await prisma.quotationTemplate.findFirst({ where: { id }, select: { id: true } });
    return !!row;
  }
  if (model === "quotation") {
    const row = await prisma.quotation.findFirst({ where: { id }, select: { id: true } });
    return !!row;
  }
  const row = await prisma.invoice.findFirst({ where: { id }, select: { id: true } });
  return !!row;
}

export type EmployeeScope =
  | { mode: "all" }
  | { mode: "company"; companyName: string }
  | { mode: "self"; email: string }
  | { mode: "deny" };

type EmployeeIdentity = {
  company?: { name: string } | null;
  companyEmail?: string | null;
  email?: string | null;
  personalEmail?: string | null;
};

/** Admins see and edit every billing record. Everyone else sees only records
 *  they created after their account existed, plus quotations (and the invoices
 *  converted from them) that were split to their staff number or nickname.
 *  Client pages never use this. */
const hiddenShareHolders = { NOT: { number: { startsWith: SHARE_HOLDER_PREFIX } } };

export async function currentQuotationFilter() {
  const access = await currentAccess();
  if (access.mode === "all") return hiddenShareHolders;
  if (access.mode === "none") return { id: { in: [] } };
  const sets = await quotationAccess(access.person);
  return { AND: [idFilter(sets.viewIds), hiddenShareHolders] };
}

export async function currentInvoiceFilter() {
  const access = await currentAccess();
  if (access.mode === "all") return null;
  if (access.mode === "none") return { id: { in: [] } };
  const sets = await invoiceAccess(access.person);
  return idFilter(sets.viewIds);
}

export async function currentTemplateFilter() {
  const access = await currentAccess();
  if (access.mode === "all") return null;
  if (access.mode === "none") return { id: { in: [] } };
  const created = await prisma.activityEvent.findMany({
    where: { documentType: "template", type: "CREATED" },
    select: { documentId: true, actorName: true },
  });
  const createdIds = created
    .filter((event) => actorOwns(event.actorName, access.person))
    .map((event) => event.documentId);
  const owned = createdIds.length
    ? await prisma.quotationTemplate.findMany({
        where: { id: { in: createdIds }, createdAt: { gte: access.person.joinedAt } },
        select: { id: true },
      })
    : [];
  return idFilter(new Set(owned.map((row) => row.id)));
}

export async function quotationVisible(id: string): Promise<boolean> {
  const access = await currentAccess();
  if (access.mode === "all") return true;
  if (access.mode === "none") return false;
  return (await quotationAccess(access.person)).viewIds.has(id);
}

export async function quotationCanModify(id: string): Promise<boolean> {
  const access = await currentAccess();
  if (access.mode === "all") return true;
  if (access.mode === "none") return false;
  return (await quotationAccess(access.person)).editIds.has(id);
}

export async function invoiceVisible(id: string): Promise<boolean> {
  const access = await currentAccess();
  if (access.mode === "all") return true;
  if (access.mode === "none") return false;
  return (await invoiceAccess(access.person)).viewIds.has(id);
}

export async function invoiceCanModify(id: string): Promise<boolean> {
  const access = await currentAccess();
  if (access.mode === "all") return true;
  if (access.mode === "none") return false;
  return (await invoiceAccess(access.person)).editIds.has(id);
}

export async function templateVisible(id: string): Promise<boolean> {
  const filter = await currentTemplateFilter();
  return passes("quotationTemplate", id, filter ? new Set((filter.id as { in: string[] }).in) : null);
}

export function andFilters(base: object, extra: Record<string, unknown> | null): any {
  if (!extra) return base;
  return { AND: [base, extra] };
}

export async function employeeScopeFor(user: { email: string; isAdmin?: boolean } | null): Promise<EmployeeScope> {
  if (!user) return { mode: "deny" };
  const directory = await readStaffDirectory();
  const profile: StaffProfile | null = profileFor(directory, user.email);
  if (profile?.label === "EXTERNAL_ADMIN") {
    return { mode: "company", companyName: profile.companyName };
  }
  if (profile?.label === "EXTERNAL_MEMBER") {
    return { mode: "self", email: normalizeEmail(user.email) };
  }
  if (user.isAdmin || isSuperAdmin(user)) return { mode: "all" };
  return { mode: "deny" };
}

export function employeeScopeWhere(scope: EmployeeScope): Record<string, unknown> | null {
  if (scope.mode === "company") {
    if (!scope.companyName.trim()) return { id: { in: [] } };
    return { company: { name: { equals: scope.companyName, mode: "insensitive" } } };
  }
  if (scope.mode === "self") {
    const email = scope.email;
    return {
      OR: [
        { companyEmail: { equals: email, mode: "insensitive" } },
        { email: { equals: email, mode: "insensitive" } },
        { personalEmail: { equals: email, mode: "insensitive" } },
      ],
    };
  }
  return null;
}

export function employeeMatchesScope(employee: EmployeeIdentity, scope: EmployeeScope): boolean {
  if (scope.mode === "all") return true;
  if (scope.mode === "deny") return false;
  if (scope.mode === "company") {
    return (employee.company?.name || "").trim().toLowerCase() === scope.companyName.trim().toLowerCase();
  }
  const email = scope.email;
  return [employee.companyEmail, employee.email, employee.personalEmail]
    .map((value) => (value || "").trim().toLowerCase())
    .includes(email);
}

export async function canManageEmployee(id: string): Promise<boolean> {
  const scope = await employeeScopeFor(await getCurrentUser());
  if (scope.mode !== "all" && scope.mode !== "company") return false;
  return employeeVisibleById(id);
}

export async function employeeVisibleById(id: string): Promise<boolean> {
  const scope = await employeeScopeFor(await getCurrentUser());
  if (scope.mode === "all") return true;
  if (scope.mode === "deny") return false;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      company: { select: { name: true } },
      companyEmail: true,
      email: true,
      personalEmail: true,
    },
  });
  if (!employee) return false;
  return employeeMatchesScope(employee, scope);
}
