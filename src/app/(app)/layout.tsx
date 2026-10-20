import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PageTransition from "@/components/PageTransition";
import RequiredSetupGate from "@/components/RequiredSetupGate";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveCompany, getSettings, getMissingRequiredSettings } from "@/lib/appSettings";
import { canOpenPath, firstAllowedHref, isSuperAdmin, loadAccessGroups, pagesForPerson } from "@/lib/accessControl";
import { getT } from "@/lib/i18n/server";

// Wraps every internal staff page (dashboard, quotations, invoices, items)
// with the Sidebar chrome (no top bar — quick-create actions and the
// signed-in user's name now live inside each page / the Sidebar itself).
// Public routes like /sign/[token] live outside this route group and never
// get this navigation.
//
// The middleware (src/middleware.ts) already redirects unauthenticated
// requests to /login before they ever reach here — this check is a second,
// server-rendered layer of defense.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await getEffectiveCompany();
  const settings = await getSettings();

  // Only the admin account ever sees the required-setup gate — settings is
  // reachable by any signed-in user, but only admin is expected to actually
  // maintain it, and gating every staff member would block people who have
  // no way to fix it themselves.
  const isAdmin = !!user.isAdmin;
  const missingSettings = isAdmin ? getMissingRequiredSettings(settings) : [];
  const stored = await loadAccessGroups();
  const superAdmin = isSuperAdmin(user);
  const pages = pagesForPerson(user, stored.groups);
  const pathname = headers().get("x-pathname") || "/";
  const allowed = canOpenPath(pathname, pages, superAdmin);
  if (!allowed) {
    const next = firstAllowedHref(pages);
    if (next) redirect(next);
  }
  const t = getT();

  return (
    <div data-shell="staff" className="min-h-screen flex">
      <Sidebar
        logoData={company.logoData}
        logoDataDark={settings.companyLogoDark}
        companyName={company.shortName || company.name}
        isAdmin={isAdmin}
        allowedPages={pages}
        canManage={superAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-8 max-w-[1400px] w-full mx-auto">
          {allowed ? (
            <PageTransition>{children}</PageTransition>
          ) : (
            <div className="card p-6 max-w-lg">
              <p className="text-sm text-ink-muted">
                {t("You do not have access to any page. Ask a full-access account to add you to a group.")}
              </p>
            </div>
          )}
        </main>
      </div>
      <RequiredSetupGate isAdmin={isAdmin} missingFields={missingSettings} />
    </div>
  );
}
