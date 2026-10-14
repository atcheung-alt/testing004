import { redirect } from "next/navigation";
import HrSidebar from "@/components/HrSidebar";
import PageTransition from "@/components/PageTransition";
import { getCurrentUser } from "@/lib/auth";
import { getAccount, isSuper } from "@/lib/access";
import { getEffectiveCompany } from "@/lib/appSettings";

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
export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const account = await getAccount();
  if (account?.companyId && !isSuper(account)) redirect("/");
  const company = await getEffectiveCompany();

  return (
    // Sidebar rendered second so it docks on the RIGHT edge of the screen —
    // the Resource Management System's Sidebar is the first (left) flex
    // child in its own layout, so this ordering is the other deliberate
    // visual cue (on top of the re-tinted color and mobile-drawer direction)
    // that you're in a different system even at a glance.
    <div data-product="hr" className="min-h-screen flex">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 sm:px-6 lg:px-10 pt-16 lg:pt-8 pb-6 lg:pb-8 max-w-[1400px] w-full mx-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <HrSidebar
        logoData={company.logoData}
        logoDataDark={company.logoDataDark}
        companyName={company.shortName || company.name}
        isAdmin={!!user.isAdmin}
      />
    </div>
  );
}
