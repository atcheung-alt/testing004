import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/authToken";

// Everything NOT listed here requires a valid session — including every
// internal API route (quotations, invoices, settings, etc). Only the login
// page/API, the token-scoped public client pages/APIs, and the cron
// endpoint (which checks its own CRON_SECRET instead of a staff session)
// are exempt.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/sign/",
  "/invoice/",
  "/recruitment-sign/",
  "/leave/",
  "/onboarding/",
  "/contract-sign/",
  // The public massage-booking page — unlike everything else on this list,
  // there's no per-record token scoping it to one client (see
  // src/app/book/page.tsx); it's a plain public form anyone can reach.
  "/book",
  // A client's own self-service "cancel my booking" link, scoped to one
  // booking's cancelToken (see src/lib/signing.ts's bookingCancelUrlFor and
  // src/app/booking-cancel/[token]/page.tsx).
  "/booking-cancel/",
  // An event's own public "manage bookings" link, scoped by that event's own
  // manageToken (see manageBookingEventUrlFor and
  // src/app/manage-booking/[token]/page.tsx) — deliberately no login, since
  // the whole point is staff can hand this out to someone without an HR
  // Plus account.
  "/manage-booking/",
  "/api/auth/",
  "/api/public/",
  "/api/cron/",
  "/_next/",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

// The subset of PUBLIC_PATH_PREFIXES that render an actual page for an
// outside visitor with no HR Plus account (client/employee token links) —
// as opposed to /login, which is the internal app's own sign-in page for
// staff. Visitors on these pages have no personal theme preference to fall
// back on the way a signed-in staff member does (see getEffectiveThemeModeFor
// in src/lib/appSettings.ts), and no reason to see whatever color theme the
// admin picked for the internal dashboard either — so the root layout forces
// these to "AUTO" instead, which resolves purely off the visitor's own
// OS/browser dark-mode setting (see the `prefers-color-scheme` block in
// globals.css). See the `x-theme-follow-system` header handoff below.
const PUBLIC_CLIENT_PATH_PREFIXES = [
  "/sign/",
  "/invoice/",
  "/recruitment-sign/",
  "/leave/",
  "/onboarding/",
  "/contract-sign/",
  "/book",
  "/booking-cancel/",
  "/manage-booking/",
];

function isPublicClientPath(pathname: string): boolean {
  return PUBLIC_CLIENT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    if (isPublicClientPath(pathname)) {
      // Forwarded as a *request* header (not a response header) so the root
      // layout's Server Component can read it via next/headers — a response
      // header would only reach the browser, not our own render.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-theme-follow-system", "1");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
