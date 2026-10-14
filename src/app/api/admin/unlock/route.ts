import { NextRequest, NextResponse } from "next/server";
import { getAccount, isSuper } from "@/lib/access";
import { adminCodeMatches, openAdminGate } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const account = await getAccount();
  if (!account || !isSuper(account)) {
    return NextResponse.json({ error: "Only the top admin can do this." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (!adminCodeMatches(code)) {
    return NextResponse.json({ error: "That security code is wrong." }, { status: 401 });
  }
  openAdminGate(account.id);
  return NextResponse.json({ ok: true });
}
