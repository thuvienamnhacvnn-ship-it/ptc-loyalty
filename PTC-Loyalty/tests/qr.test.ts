import { describe, it, expect, beforeAll } from "vitest";
import { createQrToken, verifyQrToken } from "@/lib/qr";

beforeAll(() => {
  process.env.QR_SIGNING_SECRET = "test-secret-please-change-me-1234567890";
});

const sample = {
  businessId: "biz_1",
  customerId: "cust_1",
  memberCode: "PTC-ABC123",
  secret: "nonce_1",
};

describe("QR token sign/verify", () => {
  it("verifies a freshly signed token", () => {
    const token = createQrToken(sample, 60);
    const result = verifyQrToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.c).toBe("cust_1");
      expect(result.payload.b).toBe("biz_1");
      expect(result.payload.s).toBe("nonce_1");
    }
  });

  it("rejects a tampered payload", () => {
    const token = createQrToken(sample, 60);
    const [payload, sig] = token.split(".");
    const tampered = `${payload}x.${sig}`;
    const result = verifyQrToken(tampered);
    expect(result.ok).toBe(false);
  });

  it("rejects a token with a wrong signature", () => {
    const token = createQrToken(sample, 60);
    const [payload] = token.split(".");
    const result = verifyQrToken(`${payload}.AAAAAAAAAAAAAAAAAAAAAA`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("rejects an expired token", () => {
    const token = createQrToken(sample, -1); // already expired
    const result = verifyQrToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects malformed input", () => {
    expect(verifyQrToken("not-a-token").ok).toBe(false);
  });
});
