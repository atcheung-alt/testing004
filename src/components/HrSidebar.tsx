"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  IdCard,
  Wallet,
  Clock,
  UserCircle,
  Menu,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import CompanyLogo from "@/components/CompanyLogo";
import SwitchSystemLink from "@/components/SwitchSystemLink";
import { useT } from "@/lib/i18n/client";

// Deliberately a *different* storage key from Sidebar's — collapsing the
// Resource Management rail and collapsing this one are independent choices.
const COLLAPSED_STORAGE_KEY = "hrplus-hr-sidebar-collapsed";

type NavItem = { href: string; label: string; icon: LucideIcon; comingSoon?: boolean };

// Employees (which already bundles onboarding, leave, and contracts),
// Payroll (salary runs, MPF, payslips), and Attendance (a read-only calendar
// of approved leave — see src/app/hr/attendance/page.tsx) are all real pages
// now. Bookings (the staff side of the public massage-booking calendar) used
// to live here too, but has moved to the Resource System — see
// src/app/(app)/bookings/page.tsx and Sidebar.tsx's own nav — since it isn't
// an HR-specific feature.
//
// Non-admin accounts only ever get Profile — every other page here is
// admin-only server-side (see requireAdminPage in src/lib/auth.ts), so
// there's no point showing nav items that would just bounce them back to
// Profile anyway. Admins see everything, Profile included, since an admin
// can also be an employee with their own leave balance to check.
function buildNavItems(isAdmin: boolean, t: (key: string) => string): NavItem[] {
  if (!isAdmin) {
    return [{ href: "/hr/profile", label: t("Profile"), icon: UserCircle }];
  }
  return [
    { href: "/hr", label: t("Dashboard"), icon: LayoutDashboard },
    { href: "/hr/employees", label: t("Employees"), icon: IdCard },
    { href: "/hr/payroll", label: t("Payroll"), icon: Wallet },
    { href: "/hr/attendance", label: t("Attendance"), icon: Clock },
    { href: "/hr/profile", label: t("Profile"), icon: UserCircle },
  ];
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const { href, label, icon: Icon, comingSoon } = item;
  const active = href === "/hr" ? pathname === "/hr" : pathname.startsWith(href);

  if (comingSoon) {
    return (
      <div
        title={t("Coming soon")}
        className={clsx(
          "flex items-center rounded-xl py-2.5 text-sm font-medium text-ink-faint/70 cursor-not-allowed gap-3 px-3",
          collapsed && "lg:justify-center lg:px-0 lg:gap-0"
        )}
      >
        <Icon size={17} strokeWidth={2} className="shrink-0" />
        <span className={clsx("truncate flex items-center gap-2", collapsed && "lg:hidden")}>
          {label}
          <span className="text-[9px] font-semibold uppercase tracking-wide border border-line rounded-full px-1.5 py-0.5">
            {t("Soon")}
          </span>
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      prefetch={false}
      title={collapsed ? label : undefined}
      className={clsx(
        "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] gap-3 px-3",
        collapsed && "lg:justify-center lg:px-0 lg:gap-0",
        active
          ? "bg-paper text-ink shadow-[inset_3px_0_0_rgb(var(--color-brand-500))]"
          : "text-ink-muted hover:bg-brand-50 hover:text-brand-600"
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      <span className={clsx("truncate", collapsed && "lg:hidden")}>{label}</span>
    </Link>
  );
}

function NavLinks({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function SidebarLogo({
  logoData,
  logoDataDark,
  companyName,
  className,
}: {
  logoData?: string | null;
  logoDataDark?: string | null;
  companyName?: string;
  className: string;
}) {
  if (!logoData) {
    return (
      <span className="font-display font-semibold text-lg tracking-tight truncate">
        {companyName}
      </span>
    );
  }
  return (
    <CompanyLogo logoData={logoData} logoDataDark={logoDataDark} name={companyName} className={className} />
  );
}

/** A small "HR SYSTEM" tag under the logo — the one detail that makes this
 *  clearly a different area of the app even at a glance, on top of the
 *  re-tinted accent color the rest of the shell already picks up. */
function HrBadge({ collapsed }: { collapsed?: boolean }) {
  const t = useT();
  return (
    <span
      className={clsx(
        "text-[10px] font-semibold uppercase tracking-wider text-brand-600 -mt-1",
        collapsed && "lg:hidden"
      )}
    >
      {t("HR System")}
    </span>
  );
}

function BottomLinks({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="mt-auto px-3 pt-3 border-t border-line flex flex-col gap-1 shrink-0">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        title={collapsed ? t("Log out") : undefined}
        className={clsx(
          "flex items-center rounded-xl py-2.5 text-sm font-medium text-ink-muted hover:bg-danger-50 hover:text-danger-500 transition-colors gap-3 px-3",
          collapsed && "lg:justify-center lg:px-0 lg:gap-0"
        )}
      >
        {loggingOut ? (
          <Loader2 size={17} strokeWidth={2} className="animate-spin shrink-0" />
        ) : (
          <LogOut size={17} strokeWidth={2} className="shrink-0" />
        )}
        <span className={clsx(collapsed && "lg:hidden")}>{t("Log out")}</span>
      </button>
    </div>
  );
}

export default function HrSidebar({
  logoData,
  logoDataDark,
  companyName,
  isAdmin = false,
}: {
  logoData?: string | null;
  logoDataDark?: string | null;
  companyName?: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const t = useT();
  const [narrowOpen, setNarrowOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const items = buildNavItems(isAdmin, t);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      root.dataset.staffNav = mq.matches && !narrowOpen ? "closed" : "open";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      delete root.dataset.staffNav;
    };
  }, [narrowOpen]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleRail() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      toggleCollapsed();
      return;
    }
    setNarrowOpen(false);
  }

  return (
    <>
      <aside
        className={clsx(
          "shrink-0 flex-col sticky top-0 h-screen overflow-y-auto border-l border-line bg-surface/90 backdrop-blur-sm py-6 transition-[width] duration-200 w-64 max-lg:max-w-[72vw]",
          collapsed && "lg:w-20",
          narrowOpen ? "flex" : "hidden lg:flex"
        )}
      >
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t("Expand sidebar")}
            title={t("Expand sidebar")}
            className="hidden lg:flex mx-auto mb-6 w-11 h-11 items-center justify-center rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
          >
            <ChevronLeft size={19} />
          </button>
        )}
        <div className={clsx("mb-6 px-6 flex items-center justify-between gap-2 shrink-0", collapsed && "lg:hidden")}>
          <div className="min-w-0 flex flex-col">
            <SidebarLogo
              logoData={logoData}
              logoDataDark={logoDataDark}
              companyName={companyName}
              className="h-9 max-w-full object-contain"
            />
            <HrBadge collapsed={collapsed} />
          </div>
          <button
            type="button"
            onClick={toggleRail}
            aria-label={t("Collapse sidebar")}
            title={t("Collapse sidebar")}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <SwitchSystemLink href="/" label={t("Resource Management")} collapsed={collapsed} />
        <NavLinks items={items} pathname={pathname} collapsed={collapsed} />
        <BottomLinks collapsed={collapsed} />
      </aside>

      {!narrowOpen && (
        <button
          type="button"
          onClick={() => setNarrowOpen(true)}
          aria-label={t("Open navigation menu")}
          className="lg:hidden fixed top-3.5 right-3 z-40 flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-line shadow-card"
        >
          <Menu size={19} />
        </button>
      )}
    </>
  );
}
