import { NextRequest, NextResponse } from "next/server";
import { getActivityTimeline } from "@/lib/activity";
import { quotationVisible } from "@/lib/documentAccess";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationVisible(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const events = await getActivityTimeline("quotation", params.id);
  return NextResponse.json(events);
}
