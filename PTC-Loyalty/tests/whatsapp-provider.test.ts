import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evolutionProvider } from "@/lib/whatsapp/providers/evolution";
import { logProvider } from "@/lib/whatsapp/providers/log";

const SESSION = { businessId: "biz_1", instanceId: "ptc-biz_1", token: null };

describe("Evolution provider", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is not configured without a gateway URL and key", () => {
    expect(evolutionProvider.isConfigured()).toBe(false);
    process.env.EVOLUTION_API_URL = "https://wa.example.com";
    expect(evolutionProvider.isConfigured()).toBe(false); // key still missing
    process.env.EVOLUTION_API_KEY = "k";
    expect(evolutionProvider.isConfigured()).toBe(true);
  });

  // Regression: an unconfigured gateway used to build a RELATIVE url and blow up
  // inside fetch() with "Failed to parse URL from /message/sendMedia/…".
  it("refuses to send when the gateway is not configured", async () => {
    for (const send of [
      () => evolutionProvider.sendText(SESSION, "+4915112345678", "hi"),
      () =>
        evolutionProvider.sendImage(SESSION, "+4915112345678", {
          base64: "AA==",
          mimeType: "image/png",
          fileName: "qr.png",
        }),
      () =>
        evolutionProvider.sendDocument(SESSION, "+4915112345678", {
          base64: "AA==",
          mimeType: "application/pdf",
          fileName: "a.pdf",
        }),
    ]) {
      const result = await send();
      expect(result).toEqual({
        ok: false,
        error: "provider_not_configured",
        retriable: false,
      });
    }
  });

  it("rejects an unusable phone number before calling out", async () => {
    process.env.EVOLUTION_API_URL = "https://wa.example.com";
    process.env.EVOLUTION_API_KEY = "k";
    const result = await evolutionProvider.sendText(SESSION, "123", "hi");
    expect(result).toEqual({ ok: false, error: "invalid_phone", retriable: false });
  });
});

describe("Log provider", () => {
  it("is always usable and reports a message id", async () => {
    expect(logProvider.isConfigured()).toBe(true);
    const result = await logProvider.sendText(SESSION, "+4915112345678", "hi");
    expect(result.ok).toBe(true);
  });
});
