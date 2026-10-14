import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAccount, isSuper } from "@/lib/access";

const COOKIE = "hrplus_admin_gate";
const TTL_MS = 12 * 60 * 60 * 1000;
const CODE = "040307";

function secret() {
  return process.env.AUTH_SECRET || "dev-insecure-default-secret-change-me";
}

export function adminCodeMatches(input: string) {
  const given = createHash("sha256").update(input.trim()).digest();
  const expected = createHash("sha256").update(CODE).digest();
  return timingSafeEqual(given, expected);
}

function sign(userId: string, exp: number) {
  const body = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return `${body}.${sig}`;
}

export async function adminGateOpen(userId: string) {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!id || !sig || !Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = sign(id, exp).split(".")[2];
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return id === userId;
}

export function openAdminGate(userId: string) {
  const exp = Date.now() + TTL_MS;
  cookies().set(COOKIE, sign(userId, exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export function clearAdminGate() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function requireSuperWithGate() {
  const account = await getAccount();
  if (!account || !isSuper(account)) {
    return { error: NextResponse.json({ error: "Only the top admin can do this." }, { status: 403 }) };
  }
  if (!(await adminGateOpen(account.id))) {
    return { error: NextResponse.json({ error: "Enter the admin security code." }, { status: 403 }) };
  }
  return { account };
}
