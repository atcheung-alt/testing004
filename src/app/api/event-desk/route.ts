import { NextRequest, NextResponse } from "next/server";
import { createDeskEvent, listDeskEvents, requireDeskUser } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireDeskUser())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ events: await listDeskEvents() });
}

export async function POST(request: NextRequest) {
  if (!(await requireDeskUser())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const eventDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
  if (!name) return NextResponse.json({ error: "Enter an event name." }, { status: 400 });
  const questions = Array.isArray(body.questions) ? body.questions.filter((item: unknown) => typeof item === "string") : [];
  const slots = Array.isArray(body.slots) ? body.slots.filter((item: unknown) => typeof item === "string") : [];
  const event = await createDeskEvent(name, eventDate, questions, slots);
  return NextResponse.json({ event });
}
