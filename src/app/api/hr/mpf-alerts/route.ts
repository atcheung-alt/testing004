import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { getSettings } from "@/lib/appSettings";
import { mpfReminderFor } from "@/lib/payroll";

export const dynamic = "force-dynamic";

/** Full-time employees whose MPF deadline is 10 days away or sooner. Empty when the settings toggle is off. */
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const settings = await getSettings();
  if (!settings.mpfNotificationsEnabled) {
    return NextResponse.json({ enabled: false, alerts: [] });
  }

  const employees = await prisma.employee.findMany({
    where: {
      status: { not: "FORMER" },
      employmentType: "FULL_TIME",
      mpfVerifiedAt: null,
      startDate: { not: null },
    },
    select: { id: true, name: true, nickname: true, preferredName: true, employmentType: true, startDate: true, mpfVerifiedAt: true },
  });

  const alerts = employees
    .map((employee) => {
      const reminder = mpfReminderFor(employee.employmentType, employee.startDate, employee.mpfVerifiedAt);
      if (!reminder || reminder.daysRemaining > 10) return null;
      return {
        id: employee.id,
        name: employee.nickname || employee.preferredName || employee.name,
        daysRemaining: reminder.daysRemaining,
        severity: reminder.severity,
      };
    })
    .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return NextResponse.json({ enabled: true, alerts });
}
