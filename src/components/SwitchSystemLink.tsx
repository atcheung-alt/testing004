"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import clsx from "clsx";

/**
 * The one visual element shared, on purpose, by both sidebars — Sidebar.tsx
 * (Resource Management System) renders it pointing at /hr, HrSidebar.tsx
 * (HR System) renders it pointing back at /. Same icon, same pill styling,
 * same position (directly under the logo, above the main nav) in both, so
 * switching between the two systems feels like one consistent affordance
 * rather than two different UIs that happen to both have a way back.
 *
 * Plain navigation via next/link — no transition overlay.
 */
export default function SwitchSystemLink({
  href,
  label,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={clsx(
        "flex items-center rounded-xl py-2 text-xs font-medium border border-line text-ink-muted hover:text-ink hover:border-ink-faint transition-colors mb-6 shrink-0 gap-2 px-3 mx-3",
        collapsed && "lg:justify-center lg:px-0 lg:mx-auto lg:w-10 lg:gap-0"
      )}
    >
      <ArrowLeftRight size={14} className="shrink-0" />
      <span className={clsx("truncate", collapsed && "lg:hidden")}>{label}</span>
    </Link>
  );
}
