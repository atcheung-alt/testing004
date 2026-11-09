import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { loadPayableEmployee, payrollEntryData } from "@/lib/payrollEntry";

export const dynamic = "force-dynamic";

/** Add one employee to this month only. A start after the 1st is prorated. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  const emp = employeeId ? await loadPayableEmployee(employeeId) : null;
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const existing = await prisma.payrollEntry.findFirst({
    where: { runId: run.id, employeeId: emp.id },
  });
  if (existing) return NextResponse.json(existing);

  const entry = await prisma.payrollEntry.create({
    data: { runId: run.id, ...(await payrollEntryData(emp, run.period)) },
  });
  return NextResponse.json(entry, { status: 201 });
}
