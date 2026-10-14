import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { SECTIONS } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const companyId = typeof body.companyId === "string" ? body.companyId : "";

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters for the password." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const userCount = await prisma.user.count();
  const passwordHash = await hashPassword(password);

  if (userCount === 0) {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isAdmin: true,
        role: "SUPER",
        status: "ACTIVE",
        sections: JSON.stringify(SECTIONS.map((section) => section.id)),
      },
    });
    await createSession(user);
    return NextResponse.json({ ok: true, role: "SUPER" });
  }

  if (!companyId) {
    return NextResponse.json({ error: "Choose your company." }, { status: 400 });
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "That company is not on the list." }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin: false,
      role: "MEMBER",
      status: "PENDING",
      companyId: company.id,
      sections: "[]",
    },
  });
  await createSession(user);
  return NextResponse.json({ ok: true, role: "MEMBER", status: "PENDING" });
}
