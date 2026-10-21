import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { FULL_ACCESS_EMAILS, isSuperAdmin, normalizeEmail } from "@/lib/accessControl";
import { findAccessRequest, setAccessRequestStatus } from "@/lib/accessRequests";
import { saveStaffProfile } from "@/lib/staffDirectory";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: "Full access is required." }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const existing = await findAccessRequest(params.id);
  if (!existing || existing.status !== "PENDING") {
    return NextResponse.json({ error: "That request is no longer waiting." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action === "reject") {
    await setAccessRequestStatus(existing.id, "REJECTED");
    return NextResponse.json({ ok: true });
  }

  const label = typeof body.label === "string" ? body.label : "";
  const category = typeof body.category === "string" ? body.category : "";
  if (!label || !category) {
    return NextResponse.json({ error: "Choose a payroll category and a role before approving." }, { status: 400 });
  }
  const companyName = typeof body.companyName === "string" ? body.companyName.trim().slice(0, 120) : "";
  if ((label === "EXTERNAL_ADMIN" || label === "EXTERNAL_MEMBER") && !companyName) {
    return NextResponse.json({ error: "Choose their company before approving an external role." }, { status: 400 });
  }

  const email = normalizeEmail(existing.email);
  const name = (typeof body.name === "string" ? body.name.trim() : "") || existing.name;
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 40) : "";
  const isAdmin = label === "ADMIN" || FULL_ACCESS_EMAILS.includes(email);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: name.slice(0, 80), nickname, isAdmin },
    update: { name: name.slice(0, 80), nickname, isAdmin },
    select: { id: true, email: true },
  });
  await saveStaffProfile({ email: user.email, category, label, companyName });
  await setAccessRequestStatus(existing.id, "APPROVED");
  return NextResponse.json({ ok: true, id: user.id });
}
