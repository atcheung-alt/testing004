import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { deskBaseUrl, ensureDeskTables } from "@/lib/eventDesk";
import DoorCheck from "@/components/DoorCheck";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm arrival", robots: { index: false, follow: false } };

export default async function DoorPage({ params }: { params: { token: string } }) {
  await ensureDeskTables();
  const event = await prisma.deskEvent.findUnique({ where: { doorToken: params.token }, select: { name: true, eventDate: true } });
  if (!event) notFound();
  const url = `${deskBaseUrl()}/door/${params.token}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" });
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold text-brand-500">At the venue</p>
      <h1 className="font-display text-2xl mt-2">{event.name}</h1>
      <p className="lead mt-2">{event.eventDate ? `${event.eventDate}. ` : ""}Scan this QR, then confirm with the email you booked with.</p>
      <div className="card mt-4 p-6 text-center">
        <img src={qr} alt="Event QR code" className="mx-auto h-52 w-52" />
        <DoorCheck token={params.token} />
      </div>
    </main>
  );
}
