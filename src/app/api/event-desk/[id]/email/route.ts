import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { loadDeskEvent, requireDeskUser } from "@/lib/eventDesk";
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
  const event = await loadDeskEvent(params.id);
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const png = await QRCode.toBuffer(event.doorUrl, { type: "png", margin: 1, width: 480, errorCorrectionLevel: "M" });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 520]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const image = await pdf.embedPng(png);
  page.drawText(event.name.slice(0, 48), { x: 40, y: 470, size: 16, font });
  page.drawText("Door QR", { x: 40, y: 446, size: 12, font });
  page.drawImage(image, { x: 70, y: 90, width: 280, height: 280 });
  const bytes = await pdf.save();

  await sendDocumentEmail({
    to: recipients,
    subject,
    body: message,
    fromAddress: user.email,
    deskSignature: true,
    attachment: { filename: `${event.code || "door"}-qr.pdf`, content: Buffer.from(bytes) },
  });
  return NextResponse.json({ ok: true, to: recipients });
}
