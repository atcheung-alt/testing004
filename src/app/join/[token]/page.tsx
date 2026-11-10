import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDeskTables, parseDeskQuestions, parseStringList } from "@/lib/eventDesk";
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
    left: (event.slotCap || 1) - event.bookings.filter((booking) => booking.slot === time).length,
  }));
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <JoinForm
        token={params.token}
        eventName={event.name}
        eventDate={event.eventDate}
        questions={parseDeskQuestions(event.questions)}
        slots={slots}
      />
    </main>
  );
}
