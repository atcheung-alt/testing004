import { redirect } from "next/navigation";
import HrSidebar from "@/components/HrSidebar";
import MpfNotificationPopup from "@/components/MpfNotificationPopup";
import PageTransition from "@/components/PageTransition";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveCompany, getSettings } from "@/lib/appSettings";
import { prisma } from "@/lib/prisma";
import { mpfReminderFor } from "@/lib/payroll";
import { canOpenPath, firstAllowedHref, isSuperAdmin, loadAccessGroups, pagesForPerson } from "@/lib/accessControl";
import { employeeScopeFor } from "@/lib/documentAccess";

// Wraps every page under /hr (the HR Management System) — a deliberately
// different shell from the Resource Management System's own AppLayout
// (src/app/(app)/layout.tsx): a different Sidebar component (HrSidebar,
// not Sidebar) with its own nav, and a `data-product="hr"` attribute that
// re-tints the shared brand-* CSS variables (see globals.css) so buttons,
// links, and badges pick up a distinct accent color everywhere under this
// route — without forking a single component or duplicating Tailwind
// classes. Technically still the exact same Next.js app/database/session as
// the Resource Management System; this is presentation-only separation.
//
// The middleware (src/middleware.ts) already redirects unauthenticated
// requests to /login before they ever reach here — this check is a second,
// server-rendered layer of defense, same as (app)/layout.tsx.
async function loadMpfAlerts() {
  const settings = await getSettings();
  if (!settings.mpfNotificationsEnabled) return [];
  const employees = await prisma.employee.findMany({
    where: {
      status: { not: "FORMER" },
      employmentType: "FULL_TIME",
      mpfVerifiedAt: null,
      startDate: { not: null },
    },
    select: {
      id: true,
      name: true,
      nickname: true,
      preferredName: true,
      employmentType: true,
      startDate: true,
      mpfVerifiedAt: true,
    },
  });
  return employees
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
}

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const stored = await loadAccessGroups();
  const pages = pagesForPerson(user, stored.groups);
  if (!canOpenPath("/hr", pages, isSuperAdmin(user))) {
    redirect(firstAllowedHref(pages) || "/");
  }
  const employeeScope = await employeeScopeFor(user);
  const [company, mpfAlerts] = await Promise.all([
    getEffectiveCompany(),
    user.isAdmin ? loadMpfAlerts() : Promise.resolve([]),
  ]);

  return (
    // Sidebar rendered second so it docks on the RIGHT edge of the screen —
    // the Resource Management System's Sidebar is the first (left) flex
    // child in its own layout, so this ordering is the other deliberate
    // visual cue (on top of the re-tinted color and mobile-drawer direction)
    // that you're in a different system even at a glance.
    <div data-product="hr" data-shell="staff" className="min-h-screen flex">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          <MpfNotificationPopup alerts={mpfAlerts} />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <HrSidebar
        logoData={company.logoData}
        logoDataDark={company.logoDataDark}
        companyName={company.shortName || company.name}
        isAdmin={!!user.isAdmin}
        canViewEmployees={employeeScope.mode === "company" || employeeScope.mode === "self"}
      />
    </div>
  );
}
