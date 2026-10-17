"use client";

import { usePathname } from "next/navigation";
import LanguageSwitch from "@/components/LanguageSwitch";

const STAFF_PREFIXES = [
  "/analysis",
  "/calendar",
  "/bookings",
  "/massage",
  "/quotations",
  "/invoices",
  "/receipts",
  "/recruitment",
  "/clients",
  "/items",
  "/settings",
  "/hr",
];

function hasStaffChrome(pathname: string): boolean {
  if (pathname === "/") return true;
  return STAFF_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Login and public client pages have no sidebar, so the Language button floats there. */
export default function PublicLanguageSwitch() {
  const pathname = usePathname();
  // The massage survey has its own 中文 / English switch at the top of the form.
  if (pathname.startsWith("/massage-survey")) return null;
  if (hasStaffChrome(pathname)) return null;
  return <LanguageSwitch className="fixed bottom-4 right-4 z-40" menuDirection="up" />;
}
