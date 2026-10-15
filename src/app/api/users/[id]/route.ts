import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

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
  return NextResponse.json({ success: true });
}
