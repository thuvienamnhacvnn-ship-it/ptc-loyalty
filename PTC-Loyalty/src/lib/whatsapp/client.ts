// Thin wrapper over the official Meta WhatsApp Business Platform Cloud API.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// No unofficial libraries, no WhatsApp Web automation — plain Graph API over
// HTTPS with a server-side Bearer token.

const GRAPH_BASE = "https://graph.facebook.com";

export interface WhatsAppCredentials {
  accessToken: string; // DECRYPTED at call time, never persisted in plaintext
  phoneNumberId: string;
  apiVersion?: string;
}

export interface TemplateParam {
  type: "text";
  text: string;
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retriable: boolean };

/** Normalise a phone number to Meta's expected digits form (E.164 without +). */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

async function post(
  creds: WhatsAppCredentials,
  body: Record<string, unknown>,
): Promise<SendResult> {
  const version = creds.apiVersion || "v21.0";
  const url = `${GRAPH_BASE}/${version}/${creds.phoneNumberId}/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // fail fast rather than hanging a worker
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Network / timeout errors are retriable.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network_error",
      retriable: true,
    };
  }

  let json: {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (res.ok && json.messages?.[0]?.id) {
    return { ok: true, messageId: json.messages[0].id };
  }

  const message = json.error?.message ?? `HTTP ${res.status}`;
  // 5xx and 429 are worth retrying; 4xx auth/validation errors are not.
  const retriable = res.status >= 500 || res.status === 429;
  return { ok: false, error: message, retriable };
}

/** Send an approved template message (business-initiated). */
export function sendTemplateMessage(
  creds: WhatsAppCredentials,
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
): Promise<SendResult> {
  return post(creds, {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: bodyParams.map<TemplateParam>((text) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  });
}

/** Send an image message by public URL, with an optional caption.
 *  (Business-initiated images to a customer who hasn't messaged first require an
 *  approved template; works free-form inside the 24h window / for test numbers.) */
export function sendImageMessage(
  creds: WhatsAppCredentials,
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<SendResult> {
  return post(creds, {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "image",
    image: { link: imageUrl, ...(caption ? { caption } : {}) },
  });
}

/** Send a plain text message (only valid inside the 24h customer window). */
export function sendTextMessage(
  creds: WhatsAppCredentials,
  to: string,
  text: string,
): Promise<SendResult> {
  return post(creds, {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "text",
    text: { body: text, preview_url: true },
  });
}
