import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DESK_SLOT_CAP, ensureDeskTables, parseStringList } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({ where: { joinToken: params.token } });
  if (!event) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  const slots = parseStringList(event.slots);
  if (!name || !email.includes("@") || !slots.includes(slot)) {
    return NextResponse.json({ error: "Enter a name, an email, and a time." }, { status: 400 });
  }
  const questions = parseStringList(event.questions);
  const raw = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const value = raw[question];
    answers[question] = typeof value === "string" ? value.trim().slice(0, 200) : "";
  }
  const [taken, same] = await Promise.all([
    prisma.deskBooking.count({ where: { eventId: event.id, slot } }),
    prisma.deskBooking.findFirst({ where: { eventId: event.id, email } }),
  ]);
  if (same) return NextResponse.json({ error: "This email is already booked." }, { status: 400 });
  if (taken >= DESK_SLOT_CAP) return NextResponse.json({ error: "That time is full." }, { status: 400 });
  const booking = await prisma.deskBooking.create({
    data: { eventId: event.id, name, email, slot, answers: JSON.stringify(answers) },
  });
  return NextResponse.json({ booking: { name: booking.name, slot: booking.slot } });
}
