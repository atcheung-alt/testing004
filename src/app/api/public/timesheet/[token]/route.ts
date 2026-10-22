import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sheetByToken, submitTimesheet, summarizeSlots, timesheetBasis } from "@/lib/timesheets";

export const dynamic = "force-dynamic";

async function viewFor(token: string) {
  const sheet = await sheetByToken(token);
  if (!sheet) return null;
  const employee = await prisma.employee.findUnique({
    where: { id: sheet.employeeId },
    select: { name: true, employmentType: true, payRateType: true },
  });
  if (!employee) return null;
  const basis = timesheetBasis(employee.employmentType, employee.payRateType) || "HOURLY";
  return {
    employeeName: employee.name,
    period: sheet.period,
    status: sheet.status,
    note: sheet.note,
    slots: sheet.slots,
    basis,
    ...summarizeSlots(sheet.slots),
  };
}

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const view = await viewFor(params.token);
  if (!view) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  return NextResponse.json(view);
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const body = await request.json().catch(() => ({}));
  const result = await submitTimesheet(params.token, body.slots);
  if (result.error || !result.sheet) {
    return NextResponse.json({ error: result.error || "Could not save the hours." }, { status: 400 });
  }
  const view = await viewFor(params.token);
  return NextResponse.json(view);
}
