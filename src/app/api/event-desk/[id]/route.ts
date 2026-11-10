import { NextRequest, NextResponse } from "next/server";
import { loadDeskEvent, requireDeskUser, updateDeskEvent } from "@/lib/eventDesk";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireDeskUser())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const event = await loadDeskEvent(params.id);
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ event });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireDeskUser())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const existing = await loadDeskEvent(params.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const event = await updateDeskEvent(params.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    eventDate: typeof body.eventDate === "string" ? body.eventDate : undefined,
    questions: Array.isArray(body.questions) ? body.questions.filter((item: unknown) => typeof item === "string") : undefined,
    slots: Array.isArray(body.slots) ? body.slots.filter((item: unknown) => typeof item === "string") : undefined,
  });
  return NextResponse.json({ event });
}
