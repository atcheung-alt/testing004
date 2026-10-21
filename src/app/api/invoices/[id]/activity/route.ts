import { NextRequest, NextResponse } from "next/server";
import { getActivityTimeline } from "@/lib/activity";
import { invoiceVisible } from "@/lib/documentAccess";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await invoiceVisible(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const events = await getActivityTimeline("invoice", params.id);
  return NextResponse.json(events);
}
