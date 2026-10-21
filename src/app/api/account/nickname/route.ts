import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The signed-in person's own nickname — used as the default "Made by" and colleague share name on quotations. */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { nickname: true, email: true },
  });
  return NextResponse.json({ nickname: user?.nickname || "", email: user?.email || session.email });
}

export async function PUT(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 40) : "";
  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { nickname },
    select: { nickname: true, email: true },
  });
  return NextResponse.json({ nickname: user.nickname, email: user.email });
}
