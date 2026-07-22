import crypto from "crypto";

/**
 * QR member tokens are HMAC-signed and time-boxed so that:
 *  - the raw customer id is never exposed in the QR,
 *  - a screenshot of a QR expires quickly (dynamic mode),
 *  - the server can verify authenticity without a DB round-trip for the signature.
 *
 * Token format:  base64url(payloadJSON) + "." + base64url(hmacSha256)
 */

export interface QrPayload {
  b: string; // businessId
  c: string; // customerId
  m: string; // memberCode
  s: string; // per-member secret nonce (rotatable to invalidate old QRs)
  iat: number; // issued-at (unix seconds)
  exp: number; // expiry (unix seconds)
}

function getSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "QR_SIGNING_SECRET is missing or too short. Set it in your environment.",
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
  return Buffer.from(
    input.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  );
}

function sign(payloadB64: string): string {
  return b64url(
    crypto.createHmac("sha256", getSecret()).update(payloadB64).digest(),
  );
}

/**
 * Create a signed QR token.
 * @param ttlSeconds - lifetime. Default 60s for the rotating dynamic card.
 *                     Use a long TTL for a static printable fallback card.
 */
export function createQrToken(
  data: { businessId: string; customerId: string; memberCode: string; secret: string },
  ttlSeconds = 60,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: QrPayload = {
    b: data.businessId,
    c: data.customerId,
    m: data.memberCode,
    s: data.secret,
    iat: now,
    exp: now + ttlSeconds,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

// Far-future expiry (2100-01-01) — a printed membership card must keep working
// for years, so the "static" token effectively never expires.
const STATIC_EXP = 4102444800;

/**
 * Create a FIXED, printable member QR token. Unlike createQrToken (which rotates
 * every 60s for the on-screen dynamic card), this is deterministic per customer
 * — same customer → same token bytes every time — so a printed card is stable
 * and "không đổi". Still fully signed + tenant/secret-checked on scan.
 */
export function createStaticQrToken(data: {
  businessId: string;
  customerId: string;
  memberCode: string;
  secret: string;
}): string {
  const payload: QrPayload = {
    b: data.businessId,
    c: data.customerId,
    m: data.memberCode,
    s: data.secret,
    iat: 0,
    exp: STATIC_EXP,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export type QrVerifyResult =
  | { ok: true; payload: QrPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Verify signature + expiry. Does NOT check the DB — caller must also
 *  confirm the customer exists, belongs to the business, and secret matches. */
export function verifyQrToken(token: string): QrVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sig] = parts;

  const expected = sign(payloadB64);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: QrPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
