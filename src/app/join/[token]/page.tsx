import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DESK_SLOT_CAP, ensureDeskTables, parseStringList } from "@/lib/eventDesk";
import JoinForm from "@/components/JoinForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book a time", robots: { index: false, follow: false } };

export default async function JoinPage({ params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({
    where: { joinToken: params.token },
    include: { bookings: { select: { slot: true } } },
  });
  if (!event) notFound();
  const slots = parseStringList(event.slots).map((time) => ({
    time,
    left: DESK_SLOT_CAP - event.bookings.filter((booking) => booking.slot === time).length,
  }));
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold text-brand-500">{event.name}</p>
      <h1 className="font-display text-2xl mt-2">Pick a time</h1>
      <p className="lead mt-2">{event.eventDate || "Choose one time. Name and email are required."}</p>
      <JoinForm token={params.token} questions={parseStringList(event.questions)} slots={slots} />
    </main>
  );
}
