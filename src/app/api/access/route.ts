import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const people = await prisma.user.findMany({
    select: { id: true, email: true, name: true, isAdmin: true },
    orderBy: { name: "asc" },
  });
  const stored = await loadAccessGroups();

  return NextResponse.json({
    ready: stored.ready,
    groups: stored.groups,
    pages: ACCESS_PAGES,
    fullAccessEmails: FULL_ACCESS_EMAILS,
    adminGroupId: ADMIN_GROUP_ID,
    fullGroupId: FULL_GROUP_ID,
    people,
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
