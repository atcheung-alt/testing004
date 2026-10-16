"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  LayoutTemplate,
  ReceiptText,
  Receipt as ReceiptIcon,
  Wallet,
  CalendarCheck,
  Menu,
  Users,
  Briefcase,
  Settings as SettingsIcon,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import clsx from "clsx";
import CompanyLogo from "@/components/CompanyLogo";
import SwitchSystemLink from "@/components/SwitchSystemLink";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useT } from "@/lib/i18n/client";

const COLLAPSED_STORAGE_KEY = "hrplus-sidebar-collapsed";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

// The HR System entry point is NOT in this list — it's rendered as a
// SwitchSystemLink (see below), the same shared component HrSidebar uses
// for its own "back to Resource Management" link, so both point back and
// forth with an identical affordance instead of looking like two unrelated
// UIs. It opens /hr, which renders under a completely different Sidebar
// (HrSidebar) with its own nav and a re-tinted accent color (see the
// `data-product="hr"` scoping in globals.css) — same app/database/session
// underneath, deliberately distinct once you're in it.
function buildNavGroups(t: (key: string) => string): NavGroup[] {
  return [
    {
      items: [
        { href: "/", label: t("Dashboard"), icon: LayoutDashboard },
        { href: "/bookings", label: t("Bookings"), icon: CalendarCheck },
      ],
    },
    {
      label: t("Billing"),
      items: [
        { href: "/quotations/templates", label: t("Templates"), icon: LayoutTemplate },
        { href: "/quotations", label: t("Quotations"), icon: FileText },
        { href: "/invoices", label: t("Invoices"), icon: ReceiptText },
        { href: "/receipts", label: t("Receipts"), icon: ReceiptIcon },
        { href: "/expenses", label: t("Expenses"), icon: Wallet },
      ],
    },
    {
      label: t("People"),
      items: [
        { href: "/recruitment", label: t("Recruitment"), icon: Briefcase },
        { href: "/clients", label: t("Clients"), icon: Users },
      ],
    },
    {
      items: [{ href: "/items", label: t("Item library"), icon: Package }],
    },
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
        "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] gap-3 px-3",
        collapsed && "lg:justify-center lg:px-0 lg:gap-0",
        active
          ? "bg-brand-gradient text-white shadow-soft"
          : "text-ink-muted hover:bg-brand-50 hover:text-brand-600"
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      <span className={clsx("truncate", collapsed && "lg:hidden")}>{label}</span>
    </Link>
  );
}

function NavLinks({
  navGroups,
  pathname,
  collapsed,
  onNavigate,
}: {
  navGroups: NavGroup[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-5 px-3">
      {navGroups.map((group, gi) => (
        <div key={group.label || gi} className="flex flex-col gap-0.5">
          {group.label && (
            <p
              className={clsx(
                "px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint",
                collapsed && "lg:hidden"
              )}
            >
              {group.label}
            </p>
          )}
          {group.label && collapsed && <div className="mx-2 mb-1 border-t border-line hidden lg:block" />}
          {group.items.some((item) => item.href === "/items") && (
            <LanguageSwitch collapsed={collapsed} menuDirection="up" align="left" className="mb-1" />
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
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
      <Link
        href="/settings"
        onClick={onNavigate}
        prefetch={false}
        title={collapsed ? t("Settings") : undefined}
        className={clsx(
          "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors gap-3 px-3",
          collapsed && "lg:justify-center lg:px-0 lg:gap-0",
          settingsActive
            ? "bg-brand-gradient text-white shadow-soft"
            : "text-ink-muted hover:bg-brand-50 hover:text-brand-600"
        )}
      >
        <SettingsIcon size={17} strokeWidth={2} className="shrink-0" />
        <span className={clsx(collapsed && "lg:hidden")}>{t("Settings")}</span>
      </Link>
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
  // Narrow viewports keep the tool list open on first paint. Closing it is a
  // session choice only — the next visit starts open again.
  const [narrowOpen, setNarrowOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const navGroups = buildNavGroups(t);

  // Restore the user's last choice — read after mount so server/client
  // markup matches on first paint (avoids a hydration mismatch), then
  // re-collapse a beat later if that's what they had last time.
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
      {/* Desktop sidebar. `sticky top-0 h-screen` keeps it locked to the
          viewport (independent scroll) so Settings/Log out at the bottom
          stay visible even on tall pages like Analysis, instead of
          stretching to the full page height and scrolling out of view. */}
      <aside
        className={clsx(
          "shrink-0 flex-col sticky top-0 h-screen overflow-y-auto border-r border-line bg-surface py-5 transition-[width] duration-200 w-64 max-lg:max-w-[72vw]",
          collapsed && "lg:w-20",
          narrowOpen ? "flex" : "hidden lg:flex"
        )}
      >
        {/* Wide screens collapse to icons. Narrow screens hide the whole
            rail; the menu button below brings the full tool list back. */}
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t("Expand sidebar")}
            title={t("Expand sidebar")}
            className="hidden lg:flex mx-auto mb-6 w-11 h-11 items-center justify-center rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
          >
            <ChevronRight size={19} />
          </button>
        )}
        <div className={clsx("mb-6 px-6 flex items-center justify-between gap-2 shrink-0", collapsed && "lg:hidden")}>
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
            onClick={toggleRail}
            aria-label={t("Collapse sidebar")}
            title={t("Collapse sidebar")}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <SwitchSystemLink href="/hr" label={t("HR System")} collapsed={collapsed} />
        <NavLinks navGroups={navGroups} pathname={pathname} collapsed={collapsed} />
        <BottomLinks pathname={pathname} collapsed={collapsed} />
      </aside>

      {!narrowOpen && (
        <button
          type="button"
          onClick={() => setNarrowOpen(true)}
          aria-label={t("Open navigation menu")}
          className="lg:hidden fixed top-3.5 left-3 z-40 flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-line shadow-card"
        >
          <Menu size={19} />
        </button>
      )}
    </>
  );
}
