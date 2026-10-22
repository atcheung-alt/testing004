import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/documentAccess";
import { isMailConfigured, sendDocumentEmail } from "@/lib/mailer";
import { resolveBaseUrl } from "@/lib/signing";
import { isValidPeriod } from "@/lib/payroll";
import { openTimesheet } from "@/lib/timesheets";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const period = typeof body.period === "string" ? body.period : "";
  if (!isValidPeriod(period)) {
    return NextResponse.json({ error: "Choose a month." }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const to = employee.personalEmail || employee.email || employee.companyEmail || "";
  if (!to) {
    return NextResponse.json({ error: "Add an email on the employee record before sending the link." }, { status: 400 });
  }

  const sheet = await openTimesheet(employee.id, period);
  if (!sheet) return NextResponse.json({ error: "Could not open the timesheet." }, { status: 500 });
  if (sheet.status === "APPROVED") {
    return NextResponse.json({ error: "This month is already approved." }, { status: 409 });
  }

  const url = `${resolveBaseUrl(request)}/timesheet/${sheet.token}`;
  let emailed = false;
  let emailError: string | null = null;
  if (!isMailConfigured()) {
    emailError = "Email is not configured. Copy the link instead.";
  } else {
    try {
      await sendDocumentEmail({
        to,
        subject: `Hours for ${period} — ${employee.name}`,
        body: `Please fill in the days you worked in ${period}, with the start and end time of each day.\n\nHR Plus will check the hours before pay is processed.`,
        signingUrl: url,
        ctaLabel: "Fill in hours",
      });
      emailed = true;
    } catch (err: any) {
      emailError = err?.message || "The email could not be sent.";
    }
  }

  return NextResponse.json({ url, emailed, emailError, status: sheet.status });
}
