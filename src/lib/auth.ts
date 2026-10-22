import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { FULL_ACCESS_EMAILS, normalizeEmail } from "@/lib/accessControl";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession, type SessionPayload } from "@/lib/authToken";

const REMOVED_FULL_ACCESS_EMAIL = "lucasyam@hrplus.info";
let removedFullAccessCleared = false;

/** Lucas was taken off the locked admin list. Clear the admin flag once per
 *  server start so an old account record cannot put him back on that list. */
async function clearRemovedFullAccess() {
  if (removedFullAccessCleared) return;
  removedFullAccessCleared = true;
  await prisma.user.updateMany({
    where: { email: { equals: REMOVED_FULL_ACCESS_EMAIL, mode: "insensitive" }, isAdmin: true },
    data: { isAdmin: false },
  });
}

/** Read and verify the current request's session cookie. Null if not logged in / expired. */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  try {
    await clearRemovedFullAccess();
  } catch {
    removedFullAccessCleared = false;
  }
  const email = normalizeEmail(session.email);
  // Founder accounts stay full admin even when the signed-in cookie was
  // issued before isAdmin was set. This does not write the database.
  if (FULL_ACCESS_EMAILS.includes(email)) {
    return session.isAdmin ? session : { ...session, isAdmin: true };
  }
  // Everyone else follows the account record, so taking someone off full
  // access applies on the next page instead of waiting for a new sign-in.
  try {
    const row = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });
    if (!row) return null;
    if (row.isAdmin === session.isAdmin) return session;
    return { ...session, isAdmin: row.isAdmin };
  } catch {
    return session;
  }
}

/** Set the session cookie after a successful Google sign-in. */
export async function createSession(user: { id: string; email: string; name: string; isAdmin: boolean }) {
  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    exp: Date.now() + SESSION_TTL_MS,
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * Server-component guard for admin-only pages under /hr (the dashboard,
 * Employees list/detail/create/edit, contracts, etc). Bounces non-admins to
 * their own Profile tab rather than 404ing — being signed in but lacking
 * the admin flag is an expected, unremarkable state, not a "this doesn't
 * exist" one. /hr/profile is the one page every non-admin account can
 * reach; every other /hr page is admin-only.
 */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    redirect("/hr/profile");
  }
  return user;
}

/**
 * Route-handler guard for admin-only API endpoints. Returns a 403
 * NextResponse to short-circuit with if the caller isn't an admin, or null
 * if they are and the handler should proceed. Never trust the page-level
 * gate alone for this — the API must enforce it independently.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return null;
}
