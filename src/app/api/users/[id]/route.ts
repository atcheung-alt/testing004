import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdminApi } from "@/lib/auth";
import { profileFor, readStaffDirectory, removeStaffProfile, saveStaffProfile } from "@/lib/staffDirectory";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { nickname?: string; name?: string } = {};
  if (typeof body.nickname === "string") data.nickname = body.nickname.trim().slice(0, 40);
  if (typeof body.name === "string") data.name = body.name.trim();
  const touchesProfile = "category" in body || "label" in body || "companyName" in body;
  if (!("nickname" in data) && !("name" in data) && !touchesProfile) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user =
    "nickname" in data || "name" in data
      ? await prisma.user.update({
          where: { id: params.id },
          data,
          select: { id: true, email: true, name: true, nickname: true },
        })
      : existing;
  const directory = await readStaffDirectory();
  const current = profileFor(directory, existing.email);
  let profile = current;
  if (touchesProfile) {
    const nextCategory = "category" in body ? body.category : current?.category;
    const nextLabel = "label" in body ? body.label : current?.label;
    if (!nextCategory && !nextLabel) {
      await removeStaffProfile(existing.email);
      profile = null;
    } else {
      profile = await saveStaffProfile({
        email: existing.email,
        category: nextCategory,
        label: nextLabel,
        companyName: "companyName" in body ? body.companyName : current?.companyName,
      });
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: "nickname" in user ? user.nickname : existing.nickname,
    category: profile?.category ?? null,
    label: profile?.label ?? null,
    companyName: profile?.companyName ?? "",
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const current = await getCurrentUser();
  if (current?.userId === params.id) {
    return NextResponse.json(
      { error: "You can't remove your own account while logged in as it." },
      { status: 400 }
    );
  }

  const count = await prisma.user.count();
  if (count <= 1) {
    return NextResponse.json(
      { error: "Can't remove the last remaining account — that would lock everyone out." },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id: params.id } });
  await removeStaffProfile(existing.email);
  return NextResponse.json({ success: true });
}
