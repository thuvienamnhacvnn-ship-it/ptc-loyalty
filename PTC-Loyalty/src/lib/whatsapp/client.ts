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

/** Upload a PNG to WhatsApp's media store and return its media id. More robust
 *  than an external image link (Meta doesn't have to fetch our URL). */
export async function uploadImageMedia(
  creds: WhatsAppCredentials,
  png: Uint8Array,
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const version = creds.apiVersion || "v21.0";
  const url = `${GRAPH_BASE}/${version}/${creds.phoneNumberId}/media`;
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "image/png");
    form.append("file", new Blob([png as BlobPart], { type: "image/png" }), "qr.png");
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    const json: { id?: string; error?: { message?: string } } = await res
      .json()
      .catch(() => ({}));
    if (res.ok && json.id) return { ok: true, mediaId: json.id };
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "upload_error" };
  }
}

/** Send an image message by a previously-uploaded media id, with a caption. */
export function sendImageMessageByMediaId(
  creds: WhatsAppCredentials,
  to: string,
  mediaId: string,
  caption?: string,
): Promise<SendResult> {
  return post(creds, {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "image",
    image: { id: mediaId, ...(caption ? { caption } : {}) },
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

/**
 * Send an approved template whose HEADER is an image (business-initiated, works
 * OUTSIDE the 24h window). `headerImageMediaId` is an uploaded media id (see
 * uploadImageMedia); `bodyParams` fill the template body's {{1}}, {{2}}, … (pass
 * [] if the template body has no variables).
 */
export function sendImageTemplate(
  creds: WhatsAppCredentials,
  to: string,
  templateName: string,
  languageCode: string,
  headerImageMediaId: string,
  bodyParams: string[],
): Promise<SendResult> {
  const components: Array<Record<string, unknown>> = [
    {
      type: "header",
      parameters: [{ type: "image", image: { id: headerImageMediaId } }],
    },
  ];
  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map<TemplateParam>((text) => ({ type: "text", text })),
    });
  }
  return post(creds, {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
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
