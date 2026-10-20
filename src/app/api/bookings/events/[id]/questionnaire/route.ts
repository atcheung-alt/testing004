import { NextRequest, NextResponse } from "next/server";
import { getBookingEvent } from "@/lib/bookings";
import { ensureMassageLinkForBooking, setMassageInvoice } from "@/lib/massage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const event = await getBookingEvent(params.id);
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.enable === true) {
    const token = await ensureMassageLinkForBooking(params.id);
    if (!token) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ token });
  }

  if ("invoiceId" in body) {
    const invoiceId = typeof body.invoiceId === "string" && body.invoiceId ? body.invoiceId : null;
    try {
      await setMassageInvoice(params.id, invoiceId);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "ALREADY_LINKED") {
        return NextResponse.json({ error: "ALREADY_LINKED" }, { status: 409 });
      }
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
