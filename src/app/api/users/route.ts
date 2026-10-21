import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { profileFor, readStaffDirectory, saveStaffProfile } from "@/lib/staffDirectory";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET() {
  const [users, directory] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, nickname: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    readStaffDirectory(),
  ]);
  return NextResponse.json(
    users.map((user) => {
      const profile = profileFor(directory, user.email);
      return {
        ...user,
        category: profile?.category ?? null,
        label: profile?.label ?? null,
        companyName: profile?.companyName ?? "",
      };
    })
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 40) : "";

  if (!email) {
    return NextResponse.json({ error: "Please enter their Google Workspace email." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "That email is already added." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { email, name, nickname },
    select: { id: true, email: true, name: true, nickname: true, createdAt: true },
  });
  const profile = await saveStaffProfile({
    email,
    category: body.category,
    label: body.label,
    companyName: body.companyName,
  });

  return NextResponse.json(
    { ...user, category: profile.category, label: profile.label, companyName: profile.companyName },
    { status: 201 }
  );
}
