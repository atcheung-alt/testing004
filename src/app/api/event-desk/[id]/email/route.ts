import { NextRequest, NextResponse } from "next/server";
import { requireDeskUser } from "@/lib/eventDesk";
import { sendDocumentEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireDeskUser();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const recipients = Array.isArray(body.to)
    ? body.to.map((item: unknown) => String(item).trim()).filter((item: string) => item.includes("@"))
    : [];
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  if (!recipients.length) {
    return NextResponse.json({ error: "Add at least one manager email." }, { status: 400 });
  }
  if (!subject || !message) {
    return NextResponse.json({ error: "Write a subject and a message." }, { status: 400 });
  }
  if (!params.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await sendDocumentEmail({
    to: recipients,
    subject,
    body: message,
    fromAddress: user.email,
  });
  return NextResponse.json({ ok: true, to: recipients });
}
