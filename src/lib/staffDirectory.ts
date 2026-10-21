import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/accessControl";

// Stored in the existing AccessGroup row `staff_profiles`, inside the `pages`
// text column. No new table and no new column — other rows are page-access
// groups and are left alone.
export const STAFF_DIRECTORY_ID = "staff_profiles";

export const STAFF_CATEGORIES = ["HR_PLUS_STAFF", "FULL_TIME", "PART_TIME", "FREELANCE"] as const;
export const STAFF_LABELS = ["ADMIN", "MEMBER", "EXTERNAL_ADMIN", "EXTERNAL_MEMBER"] as const;

export type StaffCategory = (typeof STAFF_CATEGORIES)[number];
export type StaffLabel = (typeof STAFF_LABELS)[number];

export type StaffProfile = {
  email: string;
  category: StaffCategory;
  label: StaffLabel;
  companyName: string;
};

export type DocumentGrant = {
  documentType: "quotation" | "invoice";
  documentId: string;
  emails: string[];
};

type Directory = {
  profiles: StaffProfile[];
  grants: DocumentGrant[];
};

const EMPTY: Directory = { profiles: [], grants: [] };

export const STAFF_CATEGORY_LABELS: Record<StaffCategory, string> = {
  HR_PLUS_STAFF: "HR Plus staff",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  FREELANCE: "Freelance",
};

export const STAFF_ROLE_LABELS: Record<StaffLabel, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  EXTERNAL_ADMIN: "External admin",
  EXTERNAL_MEMBER: "External member",
};

function asCategory(value: unknown): StaffCategory {
  return STAFF_CATEGORIES.includes(value as StaffCategory) ? (value as StaffCategory) : "HR_PLUS_STAFF";
}

function asLabel(value: unknown): StaffLabel {
  return STAFF_LABELS.includes(value as StaffLabel) ? (value as StaffLabel) : "MEMBER";
}

function parseDirectory(raw: string | null | undefined): Directory {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as { profiles?: unknown; grants?: unknown };
    if (!parsed || Array.isArray(parsed)) return EMPTY;
    const profiles: StaffProfile[] = [];
    if (Array.isArray(parsed.profiles)) {
      for (const item of parsed.profiles) {
        if (!item || typeof item !== "object") continue;
        const row = item as { email?: unknown; category?: unknown; label?: unknown; companyName?: unknown };
        if (typeof row.email !== "string" || !row.email.trim()) continue;
        profiles.push({
          email: normalizeEmail(row.email),
          category: asCategory(row.category),
          label: asLabel(row.label),
          companyName: typeof row.companyName === "string" ? row.companyName.trim().slice(0, 120) : "",
        });
      }
    }
    const grants: DocumentGrant[] = [];
    if (Array.isArray(parsed.grants)) {
      for (const item of parsed.grants) {
        if (!item || typeof item !== "object") continue;
        const row = item as { documentType?: unknown; documentId?: unknown; emails?: unknown };
        if (row.documentType !== "quotation" && row.documentType !== "invoice") continue;
        if (typeof row.documentId !== "string" || !row.documentId) continue;
        const emails = Array.isArray(row.emails)
          ? row.emails.filter((email): email is string => typeof email === "string").map(normalizeEmail).filter(Boolean)
          : [];
        if (emails.length === 0) continue;
        grants.push({ documentType: row.documentType, documentId: row.documentId, emails: Array.from(new Set(emails)) });
      }
    }
    return { profiles, grants };
  } catch {
    return EMPTY;
  }
}

export async function readStaffDirectory(): Promise<Directory> {
  try {
    const row = await prisma.accessGroup.findUnique({ where: { id: STAFF_DIRECTORY_ID } });
    return parseDirectory(row?.pages);
  } catch (err) {
    console.error("readStaffDirectory failed:", err);
    return EMPTY;
  }
}

export async function writeStaffDirectory(directory: Directory): Promise<boolean> {
  const pages = JSON.stringify({
    profiles: directory.profiles,
    grants: directory.grants.filter((grant) => grant.emails.length > 0),
  });
  try {
    await prisma.accessGroup.upsert({
      where: { id: STAFF_DIRECTORY_ID },
      create: {
        id: STAFF_DIRECTORY_ID,
        name: "Staff profiles",
        pages,
        emails: "[]",
        sortOrder: 10000,
      },
      update: { pages, name: "Staff profiles" },
    });
    return true;
  } catch (err) {
    console.error("writeStaffDirectory failed:", err);
    return false;
  }
}

export function profileFor(directory: Directory, email: string): StaffProfile | null {
  const key = normalizeEmail(email);
  return directory.profiles.find((profile) => profile.email === key) || null;
}

export async function saveStaffProfile(input: {
  email: string;
  category?: unknown;
  label?: unknown;
  companyName?: unknown;
}): Promise<StaffProfile> {
  const directory = await readStaffDirectory();
  const email = normalizeEmail(input.email);
  const next: StaffProfile = {
    email,
    category: asCategory(input.category),
    label: asLabel(input.label),
    companyName: typeof input.companyName === "string" ? input.companyName.trim().slice(0, 120) : "",
  };
  const profiles = directory.profiles.filter((profile) => profile.email !== email);
  profiles.push(next);
  await writeStaffDirectory({ ...directory, profiles });
  return next;
}

export async function removeStaffProfile(email: string): Promise<void> {
  const directory = await readStaffDirectory();
  const key = normalizeEmail(email);
  await writeStaffDirectory({
    ...directory,
    profiles: directory.profiles.filter((profile) => profile.email !== key),
    grants: directory.grants.map((grant) => ({
      ...grant,
      emails: grant.emails.filter((item) => item !== key),
    })),
  });
}

export function viewersFor(
  directory: Directory,
  documentType: "quotation" | "invoice",
  documentId: string
): string[] {
  return directory.grants.find((grant) => grant.documentType === documentType && grant.documentId === documentId)?.emails || [];
}

export async function setDocumentViewers(
  documentType: "quotation" | "invoice",
  documentId: string,
  emails: unknown
): Promise<void> {
  const directory = await readStaffDirectory();
  const cleaned = Array.isArray(emails)
    ? Array.from(
        new Set(
          emails
            .filter((email): email is string => typeof email === "string")
            .map((email) => normalizeEmail(email))
            .filter((email) => /^\S+@\S+\.\S+$/.test(email))
        )
      )
    : [];
  const grants = directory.grants.filter(
    (grant) => !(grant.documentType === documentType && grant.documentId === documentId)
  );
  if (cleaned.length > 0) grants.push({ documentType, documentId, emails: cleaned });
  await writeStaffDirectory({ ...directory, grants });
}

export function parseViewerEmails(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^\S+@\S+\.\S+$/.test(email));
}
