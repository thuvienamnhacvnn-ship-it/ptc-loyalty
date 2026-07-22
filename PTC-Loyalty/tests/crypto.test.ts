import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, isEncryptionConfigured, maskTail } from "@/lib/crypto";

describe("secret encryption (AES-256-GCM)", () => {
  it("reports configured when a valid key is present", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("round-trips a token", () => {
    const token = "EAAG1234567890_secret_access_token";
    const cipher = encryptSecret(token);
    expect(cipher).not.toContain(token); // ciphertext must not leak plaintext
    expect(cipher.split(":")).toHaveLength(3); // iv:tag:cipher
    expect(decryptSecret(cipher)).toBe(token);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-value");
    expect(decryptSecret(b)).toBe("same-value");
  });

  it("fails to decrypt tampered ciphertext (auth tag)", () => {
    const cipher = encryptSecret("secret");
    const [iv, tag, data] = cipher.split(":");
    const tampered = `${iv}:${tag}:${Buffer.from("garbage").toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("masks a secret tail for UI", () => {
    expect(maskTail("abcd1234")).toBe("••••1234");
    expect(maskTail(null)).toBe("");
  });
});
