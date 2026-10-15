/**
 * Stateless, signed session tokens — deliberately built on nothing but Web
 * Crypto (`crypto.subtle`) and other Web-standard globals (btoa/atob,
 * TextEncoder), so this same code runs unmodified in both the Edge
 * middleware (which can't reach Prisma/SQLite) and ordinary Node.js API
 * routes. No session table: the cookie itself carries the user info and an
 * expiry, HMAC-signed so it can't be forged or edited client-side.
 *
 * Trade-off: deleting a user or wanting to force-logout everyone takes
 * effect only once their existing session cookie expires (see
 * SESSION_TTL_MS below), not instantly — acceptable for a small internal
 * team tool, but worth knowing.
 */

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  // Admin-tier flag, baked into the signed cookie at login so every request
  // can check it with zero extra DB round-trips — see User.isAdmin. Like the
  // rest of this payload, it only changes on next sign-in (or once the
  // current session cookie expires), same trade-off noted above.
  isAdmin: boolean;
  exp: number; // unix ms
};

export const SESSION_COOKIE = "hrplus_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const encoder = new TextEncoder();

function getSecret(): string {
  // Set AUTH_SECRET in production — this fallback is only for zero-config
  // local development and is NOT safe to rely on for a real deployment.
  return process.env.AUTH_SECRET || "dev-insecure-default-secret-change-me";
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      encoder.encode(payloadB64)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as SessionPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
