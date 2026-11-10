import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDeskTables, parseAnswers, parseStringList } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

async function eventByHost(token: string) {
  await ensureDeskTables();
  return prisma.deskEvent.findUnique({
    where: { hostToken: token },
    include: { bookings: { orderBy: { createdAt: "desc" } } },
  });
}

function view(event: NonNullable<Awaited<ReturnType<typeof eventByHost>>>) {
  return {
    name: event.name,
    eventDate: event.eventDate,
    slots: parseStringList(event.slots),
    cap: event.slotCap || 1,
    bookings: event.bookings.map((booking) => ({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      answers: parseAnswers(booking.answers),
      slot: booking.slot,
      arrived: booking.arrived,
    })),
  };
}

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const event = await eventByHost(params.token);
  if (!event) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  return NextResponse.json(view(event));
}

export async function PATCH(request: NextRequest, { params }: { params: { token: string } }) {
  const event = await eventByHost(params.token);
  if (!event) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email) {
    const match = event.bookings.find((row) => row.email.toLowerCase() === email);
    if (!match) return NextResponse.json({ error: "No booking uses that email." }, { status: 404 });
    if (!match.arrived) {
      await prisma.deskBooking.update({ where: { id: match.id }, data: { arrived: true, arrivedAt: new Date() } });
    }
    const next = await eventByHost(params.token);
    return NextResponse.json(view(next!));
  }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const booking = event.bookings.find((row) => row.id === bookingId);
  if (!booking) return NextResponse.json({ error: "Could not update that booking." }, { status: 400 });
  const data: { slot?: string; arrived?: boolean; arrivedAt?: Date | null } = {};
  if (body.remove === true) {
    await prisma.deskBooking.delete({ where: { id: booking.id } });
    const next = await eventByHost(params.token);
    return NextResponse.json(view(next!));
  }
  if (typeof body.arrived === "boolean") {
    data.arrived = body.arrived;
    data.arrivedAt = body.arrived ? new Date() : null;
  }
  if (typeof body.slot === "string" && body.slot.trim() && body.slot.trim() !== booking.slot) {
    const slot = body.slot.trim();
    const slots = parseStringList(event.slots);
    if (!slots.includes(slot)) return NextResponse.json({ error: "Could not move that booking." }, { status: 400 });
    const taken = event.bookings.filter((row) => row.slot === slot).length;
    if (taken >= (event.slotCap || 1)) return NextResponse.json({ error: "That time is full." }, { status: 400 });
    data.slot = slot;
  }
  if (Object.keys(data).length) await prisma.deskBooking.update({ where: { id: booking.id }, data });
  const next = await eventByHost(params.token);
  return NextResponse.json(view(next!));
}
