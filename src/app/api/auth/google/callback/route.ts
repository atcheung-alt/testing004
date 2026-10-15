import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { isGoogleLoginConfigured, parseState, verifyGoogleAuthCode } from "@/lib/googleOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NONCE_COOKIE = "google_oauth_nonce";

function fail(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  response.cookies.set(NONCE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!isGoogleLoginConfigured()) {
    return fail(request, "not_configured");
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  if (!code) {
    return fail(request, "no_code");
  }

  // CSRF check: the nonce Google echoes back in `state` must match the one
  // we set in a cookie right before redirecting there.
  const cookieNonce = request.cookies.get(NONCE_COOKIE)?.value;
  const { nonce, next } = parseState(stateParam);
  if (!cookieNonce || !nonce || cookieNonce !== nonce) {
    return fail(request, "invalid_state");
  }

  let profile;
  try {
    profile = await verifyGoogleAuthCode(request, code);
  } catch (err) {
    console.error("[auth] Google code exchange/verification failed", err);
    return fail(request, "exchange_failed");
  }
  if (!profile) {
    return fail(request, "exchange_failed");
  }
  if (!profile.emailVerified) {
    return fail(request, "unverified_email");
  }

  const userCount = await prisma.user.count();

  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    // Bootstrap: if no accounts exist at all yet, the very first person to
    // sign in with Google becomes the first account automatically. Once any
    // account exists, Google sign-in only works for emails an existing
    // admin has explicitly added (Settings → Staff accounts) — never open
    // self-registration.
    if (userCount === 0) {
      // The first account ever created is automatically the admin — the
      // only account that can see Employee PII (HKID, address, birthday,
      // salary, bank details) or create/edit/delete employee records. Every
      // account added afterwards starts as a non-admin.
      user = await prisma.user.create({
        data: { email: profile.email, name: profile.name, isAdmin: true },
      });
    } else {
      return fail(request, "not_authorized");
    }
  }

  await createSession(user);
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(NONCE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return response;
}
