import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession, type SessionPayload } from "@/lib/authToken";

/** Read and verify the current request's session cookie. Null if not logged in / expired. */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
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
