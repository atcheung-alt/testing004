import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { FULL_ACCESS_EMAILS, isSuperAdmin, normalizeEmail } from "@/lib/accessControl";
import { removeStaffProfile, saveStaffProfile } from "@/lib/staffDirectory";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: "Full access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 40) : existing.nickname;
  const category = "category" in body ? body.category : undefined;
  const label = "label" in body ? body.label : undefined;
  const companyName = typeof body.companyName === "string" ? body.companyName.trim().slice(0, 120) : "";
  const email = normalizeEmail(existing.email);
  const locked = FULL_ACCESS_EMAILS.includes(email);

  if (!category && !label) {
    await removeStaffProfile(email);
    await prisma.user.update({ where: { id }, data: { nickname } });
    return NextResponse.json({ ok: true });
  }
  if ((label === "EXTERNAL_ADMIN" || label === "EXTERNAL_MEMBER") && !companyName) {
    return NextResponse.json({ error: "Choose their company for an external role." }, { status: 400 });
  }

  await saveStaffProfile({ email, category, label, companyName });
  await prisma.user.update({
    where: { id },
    data: {
      nickname,
      isAdmin: locked || label === "ADMIN",
    },
  });
  return NextResponse.json({ ok: true });
}
