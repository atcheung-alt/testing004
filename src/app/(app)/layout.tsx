import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PageTransition from "@/components/PageTransition";
import RequiredSetupGate from "@/components/RequiredSetupGate";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveCompany, getSettings, getMissingRequiredSettings } from "@/lib/appSettings";

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

  return (
    <div className="min-h-screen flex">
      <Sidebar
        logoData={company.logoData}
        logoDataDark={settings.companyLogoDark}
        companyName={company.shortName || company.name}
        isAdmin={isAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* pt-16 on mobile clears the fixed hamburger button that now floats
            directly over page content with no header bar beneath it. */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 pt-16 lg:pt-8 pb-6 lg:pb-8 max-w-[1400px] w-full mx-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <RequiredSetupGate isAdmin={isAdmin} missingFields={missingSettings} />
    </div>
  );
}
