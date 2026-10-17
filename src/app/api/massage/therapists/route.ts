import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canOpenPath, isSuperAdmin, loadAccessGroups, pagesForPerson } from "@/lib/accessControl";
import { addMassageTherapist } from "@/lib/massage";

export const dynamic = "force-dynamic";

async function deny(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const stored = await loadAccessGroups();
  const pages = pagesForPerson(user, stored.groups);
  if (!canOpenPath("/massage", pages, isSuperAdmin(user))) {
    return NextResponse.json({ error: "You cannot change the therapist list." }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = await deny();
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const result = await addMassageTherapist(name);
  if (result === "empty") return NextResponse.json({ error: "Enter a therapist name." }, { status: 400 });
  if (result === "duplicate") return NextResponse.json({ error: "This therapist is already on the list." }, { status: 409 });
  return NextResponse.json(result, { status: 201 });
}
