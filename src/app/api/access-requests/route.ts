import { NextRequest, NextResponse } from "next/server";
import { submitAccessRequest } from "@/lib/accessRequests";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const name = typeof body.name === "string" ? body.name : "";
  const companyName = typeof body.companyName === "string" ? body.companyName : "";
  const note = typeof body.note === "string" ? body.note : "";
  if (!email.trim()) {
    return NextResponse.json({ error: "Please enter your email." }, { status: 400 });
  }
  const result = await submitAccessRequest({ email, name, companyName, note });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
