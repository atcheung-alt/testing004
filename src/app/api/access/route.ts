import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPendingAccessRequests } from "@/lib/accessRequests";
import { profileFor, readStaffDirectory } from "@/lib/staffDirectory";
import {
  ACCESS_PAGES,
  ADMIN_GROUP_ID,
  FULL_ACCESS_EMAILS,
  FULL_GROUP_ID,
  isSuperAdmin,
  loadAccessGroups,
  replaceAccessGroups,
  sanitizeGroups,
  type AccessPerson,
} from "@/lib/accessControl";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) {
    return { user: null, response: NextResponse.json({ error: "Full access is required." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.response) return gate.response;

  const [people, stored, directory, requests, companies] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, nickname: true, isAdmin: true },
      orderBy: { name: "asc" },
    }),
    loadAccessGroups(),
    readStaffDirectory(),
    listPendingAccessRequests(),
    prisma.employerCompany.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return NextResponse.json({
    ready: stored.ready,
    groups: stored.groups,
    pages: ACCESS_PAGES,
    fullAccessEmails: FULL_ACCESS_EMAILS,
    adminGroupId: ADMIN_GROUP_ID,
    fullGroupId: FULL_GROUP_ID,
    requests,
    companies,
    people: people.map((person) => {
      const profile = profileFor(directory, person.email);
      return {
        ...person,
        category: profile?.category ?? null,
        label: profile?.label ?? null,
        companyName: profile?.companyName ?? "",
      };
    }),
  });
}

export async function PUT(request: NextRequest) {
  const gate = await requireSuperAdmin();
  if (gate.response) return gate.response;

  const body = await request.json().catch(() => ({}));
  const people: AccessPerson[] = await prisma.user.findMany({
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  const groups = sanitizeGroups(body.groups, people);
  const saved = await replaceAccessGroups(groups);
  if (!saved.ok) {
    return NextResponse.json(
      {
        error:
          "Access groups are not on the database yet. Everyone keeps full access, and no existing records were changed.",
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ groups });
}
