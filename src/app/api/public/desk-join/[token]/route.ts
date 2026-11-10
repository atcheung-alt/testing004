import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDeskTables, parseDeskQuestions, parseStringList } from "@/lib/eventDesk";
import { sendDocumentEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

function emailLooksDeliverable(email: string) {
  if (!/^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return false;
  const [local, domain] = email.split("@");
  if (/_{3,}|\+{2,}|[^a-z0-9]{3,}/i.test(local)) return false;
  const letters = local.match(/[a-z0-9]/gi) || [];
  if (letters.length < 3) return false;
  if (domain.includes("..") || domain.startsWith("-") || domain.endsWith("-")) return false;
  return true;
}

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({
    where: { joinToken: params.token },
    include: { bookings: { select: { slot: true } } },
  });
  if (!event) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const cap = event.slotCap || 1;
  return NextResponse.json({
    name: event.name,
    eventDate: event.eventDate,
    questions: parseDeskQuestions(event.questions),
    slots: parseStringList(event.slots).map((time) => ({
      time,
      left: cap - event.bookings.filter((booking) => booking.slot === time).length,
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({ where: { joinToken: params.token } });
  if (!event) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  const slots = parseStringList(event.slots);
  if (!name || !slots.includes(slot)) {
    return NextResponse.json({ error: "Enter a name, an email, and a time." }, { status: 400 });
  }
  if (!emailLooksDeliverable(email)) {
    return NextResponse.json(
      { error: "That email address looks wrong. Type it again and make sure it is correct." },
      { status: 400 }
    );
  }
  const questions = parseDeskQuestions(event.questions);
  const raw = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const value = raw[question.label];
    answers[question.label] = typeof value === "string" ? value.trim().slice(0, 200) : "";
    if (question.required && !answers[question.label]) {
      return NextResponse.json({ error: `Enter ${question.label}.` }, { status: 400 });
    }
  }
  const [taken, same] = await Promise.all([
    prisma.deskBooking.count({ where: { eventId: event.id, slot } }),
    prisma.deskBooking.findFirst({ where: { eventId: event.id, email } }),
  ]);
  if (same) return NextResponse.json({ error: "This email is already booked." }, { status: 400 });
  if (taken >= (event.slotCap || 1)) return NextResponse.json({ error: "That time is full." }, { status: 400 });
  const booking = await prisma.deskBooking.create({
    data: { eventId: event.id, name, email, slot, answers: JSON.stringify(answers) },
  });
  const when = /^\d{4}-\d{2}-\d{2}$/.test(event.eventDate)
    ? new Date(`${event.eventDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : event.eventDate;
  const from = event.confirmFrom?.includes("@") ? event.confirmFrom : "contact@hrplus.info";
  try {
    await sendDocumentEmail({
      to: email,
      subject: `You’re booked — ${event.name}`,
      fromAddress: from,
      deskSignature: true,
      body: [
        `Hello ${name},`,
        "",
        "This confirms your place at the activity. Keep this email. On the day, scan the event QR and enter the same email address.",
        "",
        `Activity: ${event.name}`,
        `Date: ${when || "To be confirmed"}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Time slot: ${slot}`,
        "",
        "HR Plus",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[desk-join] confirmation email failed", err);
    await prisma.deskBooking.delete({ where: { id: booking.id } }).catch(() => undefined);
    return NextResponse.json(
      { error: "We could not send the confirmation. Type the email again and make sure the address is correct." },
      { status: 502 }
    );
  }
  return NextResponse.json({ booking: { name: booking.name, slot: booking.slot } });
}
