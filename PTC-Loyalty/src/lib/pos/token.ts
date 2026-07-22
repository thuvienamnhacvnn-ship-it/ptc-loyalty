import crypto from "crypto";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// POS token utilities.
//   • Access token  — compact HMAC-SHA256 JWT (header.payload.sig). Short-lived
//                     (1h). Carries only the userId; the server always re-derives
//                     businessId/role/branch from the DB, so a stale or forged
//                     businessId can never be honoured.
//   • Refresh token — opaque 32-byte random string. Only its SHA-256 hash is
//                     persisted (PosRefreshToken). Rotated on every refresh.
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.POS_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "POS_JWT_SECRET (or AUTH_SECRET) is missing or too short. Set it in your environment.",
    );
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signHmac(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

interface AccessPayload {
  sub: string; // userId
  typ: "pos-access";
  iat: number;
  exp: number;
}

export interface IssuedAccess {
  token: string;
  expiresAt: number; // unix ms
}

/** Create a short-lived signed access token for a user. */
export function createAccessToken(userId: string): IssuedAccess {
  const now = Date.now();
  const exp = now + ACCESS_TTL_MS;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: AccessPayload = {
    sub: userId,
    typ: "pos-access",
    iat: Math.floor(now / 1000),
    exp: Math.floor(exp / 1000),
  };
  const body = `${header}.${b64url(JSON.stringify(payload))}`;
  return { token: `${body}.${signHmac(body)}`, expiresAt: exp };
}

export type AccessVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Verify an access token's signature and expiry (no DB access). */
export function verifyAccessToken(token: string): AccessVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [header, payloadB64, sig] = parts;
  const body = `${header}.${payloadB64}`;

  const expected = signHmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: AccessPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload.typ !== "pos-access" || typeof payload.sub !== "string") {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, userId: payload.sub };
}

function hashRefresh(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface IssuedRefresh {
  token: string; // raw — returned to client ONCE, never stored
  expiresAt: number; // unix ms
}

/** Mint a new refresh token row and return the raw token to the caller. */
export async function issueRefreshToken(
  userId: string,
  businessId: string | null,
  deviceLabel: string | null,
): Promise<IssuedRefresh> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await db.posRefreshToken.create({
    data: {
      userId,
      tokenHash: hashRefresh(raw),
      businessId: businessId ?? undefined,
      deviceLabel: deviceLabel ?? undefined,
      expiresAt,
    },
  });
  return { token: raw, expiresAt: expiresAt.getTime() };
}

export type RefreshConsumeResult =
  | { ok: true; userId: string }
  | { ok: false };

/**
 * Validate a refresh token and rotate it: the presented token is revoked and a
 * fresh one must be issued by the caller. Prevents replay of a stolen token
 * after a legitimate refresh.
 */
export async function consumeRefreshToken(
  raw: string,
): Promise<RefreshConsumeResult> {
  const row = await db.posRefreshToken.findUnique({
    where: { tokenHash: hashRefresh(raw) },
  });
  if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
    return { ok: false };
  }
  await db.posRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date(), lastUsedAt: new Date() },
  });
  return { ok: true, userId: row.userId };
}

/** Revoke a refresh token (logout). Silent if it does not exist. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await db.posRefreshToken
    .updateMany({
      where: { tokenHash: hashRefresh(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}
