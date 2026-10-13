"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  FileText,
  LayoutTemplate,
  ReceiptText,
  Receipt as ReceiptIcon,
  Wallet,
  BarChart3,
  CalendarDays,
  CalendarCheck,
  Menu,
  X,
  Users,
  Briefcase,
  Settings as SettingsIcon,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import Portal from "@/components/Portal";
import CompanyLogo from "@/components/CompanyLogo";
import SwitchSystemLink from "@/components/SwitchSystemLink";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useT } from "@/lib/i18n/client";

const COLLAPSED_STORAGE_KEY = "hrplus-sidebar-collapsed";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Groups with `boxed: true` render inside a bordered container so related
// pages read as one bundled section rather than a flat list — currently the
// Quotation → Invoice → Receipt document pipeline, and Recruitment (kept in
// its own matching box for the same "this is its own subsystem" visual cue,
// even though it's a single link today).
//
// The HR System entry point is NOT in this list — it's rendered as a
// SwitchSystemLink (see below), the same shared component HrSidebar uses
// for its own "back to Resource Management" link, so both point back and
// forth with an identical affordance instead of looking like two unrelated
// UIs. It opens /hr, which renders under a completely different Sidebar
// (HrSidebar) with its own nav and a re-tinted accent color (see the
// `data-product="hr"` scoping in globals.css) — same app/database/session
// underneath, deliberately distinct once you're in it.
function buildNavGroups(t: (key: string) => string): { items: NavItem[]; boxed?: boolean }[] {
  return [
    { items: [{ href: "/", label: t("Dashboard"), icon: LayoutDashboard }] },
    { items: [{ href: "/analysis", label: t("Analysis"), icon: BarChart3 }] },
    { items: [{ href: "/calendar", label: t("Calendar"), icon: CalendarDays }] },
    // Moved here from the HR System's own sidebar — see the note on
    // src/app/(app)/bookings/page.tsx. It's the staff side of the public
    // massage-booking calendar (src/app/book), not an HR-specific feature.
    { items: [{ href: "/bookings", label: t("Bookings"), icon: CalendarCheck }] },
    {
      boxed: true,
      items: [
        { href: "/quotations", label: t("Quotations"), icon: FileText },
        { href: "/quotations/templates", label: t("Templates"), icon: LayoutTemplate },
        { href: "/invoices", label: t("Invoices"), icon: ReceiptText },
        { href: "/expenses", label: t("Expenses"), icon: Wallet },
        { href: "/receipts", label: t("Receipts"), icon: ReceiptIcon },
      ],
    },
    {
      boxed: true,
      items: [{ href: "/recruitment", label: t("Recruitment"), icon: Briefcase }],
    },
    { items: [{ href: "/clients", label: t("Clients"), icon: Users }] },
    { items: [{ href: "/items", label: t("Item library"), icon: Package }] },
  ];
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  boxed,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  boxed?: boolean;
}) {
  const { href, label, icon: Icon } = item;
  const active =
    href === "/"
      ? pathname === "/"
      : href === "/quotations"
      ? pathname.startsWith("/quotations") && !pathname.startsWith("/quotations/templates")
      : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      prefetch={false}
      title={collapsed ? label : undefined}
      className={clsx(
        "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active
          ? "bg-brand-gradient text-white shadow-soft"
          : boxed
          ? "text-ink-muted hover:bg-brand-100/90 hover:text-brand-600"
          : "text-ink-muted hover:bg-brand-50 hover:text-brand-600"
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function NavLinks({
  navGroups,
  pathname,
  collapsed,
  onNavigate,
}: {
  navGroups: { items: NavItem[]; boxed?: boolean }[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-2 px-3">
      {navGroups.map((group, gi) =>
        group.boxed ? (
          <div
            key={gi}
            className={clsx(
              "flex flex-col gap-0.5 rounded-xl bg-brand-50/70",
              collapsed ? "p-1" : "p-1.5"
            )}
          >
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
                boxed
              />
            ))}
          </div>
        ) : (
          <div key={gi} className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        )
      )}
    </nav>
  );
}

/** Sidebar-specific wrapper around the shared `CompanyLogo` — adds the
 *  plain company-name text fallback used only here (the other pages that
 *  render `CompanyLogo` — login, public document pages — each style their
 *  own fallback differently). */
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

/** Settings link + Log out button, pinned to the bottom of the sidebar
 *  (both the desktop rail and the mobile drawer render this). */
function BottomLinks({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
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

  const settingsActive = pathname.startsWith("/settings");

  return (
    <div className="mt-auto px-3 pt-3 border-t border-line flex flex-col gap-1 shrink-0">
      <LanguageSwitch collapsed={collapsed} menuDirection="up" align={collapsed ? "left" : "right"} className={collapsed ? "mx-auto" : "px-0"} />
      <Link
        href="/settings"
        onClick={onNavigate}
        prefetch={false}
        title={collapsed ? t("Settings") : undefined}
        className={clsx(
          "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          settingsActive
            ? "bg-brand-gradient text-white shadow-soft"
            : "text-ink-muted hover:bg-brand-50 hover:text-brand-600"
        )}
      >
        <SettingsIcon size={17} strokeWidth={2} className="shrink-0" />
        {!collapsed && t("Settings")}
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        title={collapsed ? t("Log out") : undefined}
        className={clsx(
          "flex items-center rounded-xl py-2.5 text-sm font-medium text-ink-muted hover:bg-danger-50 hover:text-danger-500 transition-colors",
          collapsed ? "justify-center px-0" : "gap-3 px-3"
        )}
      >
        {loggingOut ? (
          <Loader2 size={17} strokeWidth={2} className="animate-spin shrink-0" />
        ) : (
          <LogOut size={17} strokeWidth={2} className="shrink-0" />
        )}
        {!collapsed && t("Log out")}
      </button>
    </div>
  );
}

export default function Sidebar({
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
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navGroups = buildNavGroups(t);

  // Restore the user's last choice — read after mount so server/client
  // markup matches on first paint (avoids a hydration mismatch), then
  // re-collapse a beat later if that's what they had last time.
  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      {/* Desktop sidebar. `sticky top-0 h-screen` keeps it locked to the
          viewport (independent scroll) so Settings/Log out at the bottom
          stay visible even on tall pages like Analysis, instead of
          stretching to the full page height and scrolling out of view. */}
      <aside
        className={clsx(
          "hidden lg:flex shrink-0 flex-col sticky top-0 h-screen overflow-y-auto border-r border-line bg-surface/90 backdrop-blur-sm py-6 transition-[width] duration-200",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Collapsed: a dedicated expand button sits where the logo would
            be. Expanded: the logo is a plain, non-interactive display again,
            with its own separate collapse button beside it. */}
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t("Expand sidebar")}
            title={t("Expand sidebar")}
            className="mx-auto mb-6 w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
          >
            <ChevronRight size={19} />
          </button>
        ) : (
          <div className="mb-6 px-6 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0 flex items-center">
              <SidebarLogo
                logoData={logoData}
                logoDataDark={logoDataDark}
                companyName={companyName}
                className="h-9 max-w-full object-contain"
              />
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={t("Collapse sidebar")}
              title={t("Collapse sidebar")}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}

        <SwitchSystemLink href="/hr" label={t("HR System")} collapsed={collapsed} />
        <NavLinks navGroups={navGroups} pathname={pathname} collapsed={collapsed} />
        <BottomLinks pathname={pathname} collapsed={collapsed} />
      </aside>

      {/* Mobile top bar trigger + drawer — always shows full labels; the
          collapse/expand affordance above is a desktop-only rail since the
          drawer already hides itself when closed. */}
      <div className="lg:hidden">
        <LanguageSwitch className="fixed top-3.5 right-3 z-40" menuDirection="down" />
        <button
          onClick={() => setOpen(true)}
          aria-label={t("Open navigation menu")}
          className="fixed top-3.5 left-3 z-40 flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-line shadow-card"
        >
          <Menu size={19} />
        </button>

        {open && (
          <Portal>
          <div className="fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-ink/40 animate-fade-in"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative w-72 max-w-[80vw] bg-surface h-full py-6 shadow-xl flex flex-col overflow-y-auto animate-slide-in-left">
              <div className="px-6 mb-6 flex items-center justify-between shrink-0">
                <SidebarLogo
                  logoData={logoData}
                  logoDataDark={logoDataDark}
                  companyName={companyName}
                  className="h-9 max-w-[70%] object-contain"
                />
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t("Close navigation menu")}
                  className="text-ink-muted hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>
              <SwitchSystemLink href="/hr" label={t("HR System")} onNavigate={() => setOpen(false)} />
              <NavLinks navGroups={navGroups} pathname={pathname} onNavigate={() => setOpen(false)} />
              <BottomLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
          </Portal>
        )}
      </div>
    </>
  );
}
