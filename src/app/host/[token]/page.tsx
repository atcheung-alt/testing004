import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDeskTables, parseAnswers, parseStringList } from "@/lib/eventDesk";
import HostBoard from "@/components/HostBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Event bookings", robots: { index: false, follow: false } };

export default async function HostPage({ params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({
    where: { hostToken: params.token },
    include: { bookings: { orderBy: { createdAt: "desc" } } },
  });
  if (!event) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <HostBoard
        token={params.token}
        initial={{
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
        }}
      />
    </main>
  );
}
