import crypto from "crypto";

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets that must live in
 * the database but never reach the client — e.g. WhatsApp Cloud API access tokens.
 *
 * Ciphertext format: base64(iv):base64(authTag):base64(cipher).
 *
 * Key: `ENCRYPTION_KEY` env var, a 32-byte key encoded as base64 or hex.
 * Generate one with:  openssl rand -base64 32
 *
 * This module is server-only. Never import it into a client component.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.",
    );
  }
  // Accept base64 or hex; must decode to exactly 32 bytes.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
    );
  }
  cachedKey = key;
  return key;
}

/** Returns true when a usable ENCRYPTION_KEY is configured. */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** Show only the last 4 chars of a secret for UI confirmation ("••••1234"). */
export function maskTail(value: string | null | undefined): string {
  if (!value) return "";
  const tail = value.slice(-4);
  return `••••${tail}`;
}
