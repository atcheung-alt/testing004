import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { sendDocumentEmail } from "@/lib/mailer";
import { bookingInviteEmailContent } from "@/lib/settings";
import { getEffectiveCompany } from "@/lib/appSettings";
import { bookingEventUrlFor } from "@/lib/signing";
import { getBookingEvent, setBookingEventCompanyEmail } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Staff send the public booking link to the company on this event. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const event = await getBookingEvent(params.id);
  if (!event) return NextResponse.json({ error: "Booking event not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const companyEmail = String(body.companyEmail || "").trim();
  if (!companyEmail.includes("@")) {
    return NextResponse.json({ error: "Enter the company email." }, { status: 400 });
  }

  const saved = await setBookingEventCompanyEmail(params.id, companyEmail);
  const hr = await getEffectiveCompany();
  const hrName = hr.shortName || hr.name;
  const bookingUrl = bookingEventUrlFor(event.id, request);
  const { subject, body: emailBody } = bookingInviteEmailContent({
    eventName: event.name,
    companyName: hrName,
    bookingUrl,
  });

  try {
    await sendDocumentEmail({
      to: companyEmail,
      subject,
      body: emailBody,
      signingUrl: bookingUrl,
      ctaLabel: "Open the booking link",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "The email address was saved, but the message could not be sent.", companyEmail },
      { status: 502 }
    );
  }

  await logActivity({
    documentType: "booking",
    documentId: event.id,
    type: "EMAIL_SENT",
    description: `Booking link emailed to ${companyEmail}`,
  });

  return NextResponse.json({ companyEmail: saved?.companyEmail || companyEmail });
}
