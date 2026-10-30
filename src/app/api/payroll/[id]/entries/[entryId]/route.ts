import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { computeEntryTotals } from "@/lib/payroll";

export const dynamic = "force-dynamic";

/**
 * Update one employee's entry within a payroll run: units worked
 * (days/hours), whether MPF applies, a manual rate override, a one-off
 * bonus (Full time only), and a free-text note. Editable at any time — runs
 * no longer lock once finalized (see PayrollRunEntries.tsx). Gross/MPF/net
 * are always recomputed server-side from whatever the resulting fields are,
 * rather than trusted from the client — same reasoning as computeTotals
 * elsewhere in this app.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const entry = await prisma.payrollEntry.findUnique({
    where: { id: params.entryId },
    include: {
      run: { select: { period: true } },
      employee: { select: { startDate: true } },
    },
  });
  if (!entry || entry.runId !== params.id) {
    return NextResponse.json({ error: "Payroll entry not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const unitsWorked = body.unitsWorked !== undefined ? Number(body.unitsWorked) || 0 : entry.unitsWorked;
  const mpfApplicable =
    typeof body.mpfApplicable === "boolean" ? body.mpfApplicable : entry.mpfApplicable;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : entry.notes;
  // The rate itself is editable too — e.g. folding in a one-off adjustment
  // for this run only, without touching the employee's own record.
  const rate = body.rate !== undefined ? Number(body.rate) || 0 : entry.rate;

  // Bonus only ever applies to Full time entries — see the schema comment
  // on PayrollEntry.bonus and the "Bonus" column in PayrollRunEntries.tsx,
  // which only renders it for FULL_TIME rows in the first place. Reject it
  // server-side too rather than silently ignoring it, so a stray/forged
  // request on a non-Full time entry surfaces as an error instead of
  // quietly doing nothing.
  if (body.bonus !== undefined && entry.employmentType !== "FULL_TIME") {
    return NextResponse.json(
      { error: "Bonus only applies to full-time employees." },
      { status: 400 }
    );
  }
  const bonus = body.bonus !== undefined ? Math.max(0, Number(body.bonus) || 0) : entry.bonus;
  const paidAt = typeof body.paid === "boolean" ? (body.paid ? new Date() : null) : entry.paidAt;

  const totals = computeEntryTotals({
    payBasis: entry.payBasis,
    rate,
    unitsWorked,
    mpfApplicable,
    bonus,
    employmentType: entry.employmentType,
    startDate: entry.employee?.startDate ?? null,
    period: entry.run.period,
  });

  const updated = await prisma.payrollEntry.update({
    where: { id: entry.id },
    data: { unitsWorked, mpfApplicable, notes, rate, bonus, paidAt, ...totals },
  });

  return NextResponse.json(updated);
}
