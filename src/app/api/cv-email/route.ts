import { NextRequest, NextResponse } from "next/server";
import { listCvEmails, saveCvEmail } from "@/lib/cvEmail";

export const runtime = "nodejs";

export async function GET() {
  try {
    const drafts = await listCvEmails();
    return NextResponse.json({ drafts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not load email drafts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 8) : [];
  if (!String(body.subject || "").trim() && !String(body.bodyHtml || "").trim() && candidates.length === 0) {
    return NextResponse.json({ error: "Add a candidate or some email text before saving." }, { status: 400 });
  }
  try {
    const draft = await saveCvEmail({
      id: typeof body.id === "string" ? body.id : "",
      to: String(body.to || ""),
      company: String(body.company || ""),
      position: String(body.position || ""),
      subject: String(body.subject || ""),
      bodyHtml: String(body.bodyHtml || ""),
      candidates,
    });
    return NextResponse.json({ draft });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not save the draft." }, { status: 500 });
  }
}
