import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DESK_SLOT_CAP, ensureDeskTables, parseAnswers, parseStringList } from "@/lib/eventDesk";

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
    cap: DESK_SLOT_CAP,
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
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  const slots = parseStringList(event.slots);
  const booking = event.bookings.find((row) => row.id === bookingId);
  if (!booking || !slots.includes(slot)) return NextResponse.json({ error: "Could not move that booking." }, { status: 400 });
  if (booking.slot !== slot) {
    const taken = event.bookings.filter((row) => row.slot === slot).length;
    if (taken >= DESK_SLOT_CAP) return NextResponse.json({ error: "That time is full." }, { status: 400 });
    await prisma.deskBooking.update({ where: { id: booking.id }, data: { slot } });
  }
  const next = await eventByHost(params.token);
  return NextResponse.json(view(next!));
}
