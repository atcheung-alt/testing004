import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin, normalizeEmail } from "@/lib/accessControl";
import { profileFor, readStaffDirectory, type StaffProfile } from "@/lib/staffDirectory";

type SessionUser = { email: string; name?: string; isAdmin?: boolean };

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

function emailsInText(value: string | null | undefined): string[] {
  if (!value) return [];
  return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.toLowerCase());
}

function creatorMatch(actorName: string | null | undefined, email: string, aliases: string[]): boolean {
  const named = (actorName || "").trim().toLowerCase();
  if (!named) return false;
  if (named === email || emailsInText(actorName).includes(email)) return true;
  return aliases.some((alias) => alias && named === alias.toLowerCase());
}

async function aliasesFor(user: SessionUser): Promise<string[]> {
  const email = normalizeEmail(user.email);
  const row = await prisma.user.findUnique({
    where: { email },
    select: { nickname: true, name: true },
  });
  return Array.from(
    new Set([email, user.name || "", row?.name || "", row?.nickname || ""].map((item) => item.trim()).filter(Boolean))
  );
}

/** Freelance accounts only see documents they created, addressed to them, or that an admin listed their email on. */
export async function quotationVisibilityFilter(user: SessionUser | null): Promise<Record<string, unknown> | null> {
  if (!user) return { id: { in: [] } };
  const directory = await readStaffDirectory();
  const profile = profileFor(directory, user.email);
  if (profile?.category !== "FREELANCE") return null;

  const email = normalizeEmail(user.email);
  const aliases = await aliasesFor(user);
  const created = await prisma.activityEvent.findMany({
    where: { documentType: "quotation", type: "CREATED" },
    select: { documentId: true, actorName: true },
  });
  const createdIds = created
    .filter((event) => creatorMatch(event.actorName, email, aliases))
    .map((event) => event.documentId);
  const grantedIds = directory.grants
    .filter((grant) => grant.documentType === "quotation" && grant.emails.includes(email))
    .map((grant) => grant.documentId);
  const ids = Array.from(new Set([...createdIds, ...grantedIds]));
  const or: Record<string, unknown>[] = [
    { customerEmail: { equals: email, mode: "insensitive" } },
    ...aliases.map((alias) => ({ preparedBy: { equals: alias, mode: "insensitive" } })),
  ];
  if (ids.length > 0) or.push({ id: { in: ids } });
  return { OR: or };
}

export async function invoiceVisibilityFilter(user: SessionUser | null): Promise<Record<string, unknown> | null> {
  if (!user) return { id: { in: [] } };
  const directory = await readStaffDirectory();
  const profile = profileFor(directory, user.email);
  if (profile?.category !== "FREELANCE") return null;

  const email = normalizeEmail(user.email);
  const aliases = await aliasesFor(user);
  const created = await prisma.activityEvent.findMany({
    where: { documentType: "invoice", type: "CREATED" },
    select: { documentId: true, actorName: true },
  });
  const createdIds = created
    .filter((event) => creatorMatch(event.actorName, email, aliases))
    .map((event) => event.documentId);
  const grantedIds = directory.grants
    .filter((grant) => grant.documentType === "invoice" && grant.emails.includes(email))
    .map((grant) => grant.documentId);
  const ids = Array.from(new Set([...createdIds, ...grantedIds]));
  const or: Record<string, unknown>[] = [{ customerEmail: { equals: email, mode: "insensitive" } }];
  if (ids.length > 0) or.push({ id: { in: ids } });
  return { OR: or };
}

export async function currentQuotationFilter() {
  return quotationVisibilityFilter(await getCurrentUser());
}

export async function currentInvoiceFilter() {
  return invoiceVisibilityFilter(await getCurrentUser());
}

export async function quotationVisible(id: string): Promise<boolean> {
  const filter = await currentQuotationFilter();
  if (!filter) return true;
  const row = await prisma.quotation.findFirst({ where: { AND: [{ id }, filter] }, select: { id: true } });
  return !!row;
}

export async function invoiceVisible(id: string): Promise<boolean> {
  const filter = await currentInvoiceFilter();
  if (!filter) return true;
  const row = await prisma.invoice.findFirst({ where: { AND: [{ id }, filter] }, select: { id: true } });
  return !!row;
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
