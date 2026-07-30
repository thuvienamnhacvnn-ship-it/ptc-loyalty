import crypto from "node:crypto";
import type { WhatsappProvider } from "./types";

/**
 * Development provider: pairs instantly, sends nothing, logs everything.
 *
 * Used automatically when no real provider is configured, so the whole signup →
 * QR → "message sent" flow stays exercisable locally without a gateway. Every
 * message is still written to WhatsAppMessageLog by the caller, so the dashboard
 * looks exactly like production.
 */

function line(label: string, to: string, detail: string) {
  // eslint-disable-next-line no-console
  console.info(`[whatsapp:log] ${label} → ${to} :: ${detail}`);
}

export const logProvider: WhatsappProvider = {
  id: "log",
  label: "Chế độ thử (không gửi thật)",

  isConfigured() {
    return true;
  },

  async connect(session) {
    line("connect", session.businessId, session.instanceId);
    return { state: "CONNECTED" };
  },

  async disconnect(session) {
    line("disconnect", session.businessId, session.instanceId);
  },

  async getStatus() {
    return { state: "CONNECTED", phoneNumber: "490000000000", profileName: "PTC Dev" };
  },

  async sendText(_session, to, text) {
    line("text", to, text.replace(/\n/g, " ⏎ ").slice(0, 160));
    return { ok: true, messageId: `log_${crypto.randomUUID()}` };
  },

  async sendImage(_session, to, image, caption) {
    line("image", to, `${image.fileName} (${image.base64.length}b) ${caption ?? ""}`.trim());
    return { ok: true, messageId: `log_${crypto.randomUUID()}` };
  },

  async sendDocument(_session, to, document, caption) {
    line("document", to, `${document.fileName} ${caption ?? ""}`.trim());
    return { ok: true, messageId: `log_${crypto.randomUUID()}` };
  },
};
