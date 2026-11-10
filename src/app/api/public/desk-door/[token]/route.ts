import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDeskTables } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({ where: { doorToken: params.token }, select: { name: true, eventDate: true } });
  if (!event) return NextResponse.json({ error: "This QR code is not valid." }, { status: 404 });
  return NextResponse.json({ name: event.name, eventDate: event.eventDate });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({ where: { doorToken: params.token } });
  if (!event) return NextResponse.json({ error: "This QR code is not valid." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@")) return NextResponse.json({ error: "Enter the email you booked with." }, { status: 400 });
  const booking = await prisma.deskBooking.findFirst({ where: { eventId: event.id, email } });
  if (!booking) return NextResponse.json({ error: "No booking for that email." }, { status: 404 });
  if (!booking.arrived) {
    await prisma.deskBooking.update({ where: { id: booking.id }, data: { arrived: true, arrivedAt: new Date() } });
  }
  return NextResponse.json({ name: booking.name, slot: booking.slot, arrived: true });
}
