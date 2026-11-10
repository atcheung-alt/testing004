import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDeskTables } from "@/lib/eventDesk";
import DoorCheck from "@/components/DoorCheck";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm arrival", robots: { index: false, follow: false } };

export default async function DoorPage({ params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({ where: { doorToken: params.token }, select: { name: true } });
  if (!event) notFound();
  return <DoorCheck token={params.token} eventName={event.name} />;
}
