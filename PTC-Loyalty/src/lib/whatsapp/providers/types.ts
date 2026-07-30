/**
 * The provider-agnostic WhatsApp contract.
 *
 * PTC-BONUS never owns a WhatsApp number: every restaurant messages its own
 * customers from ITS OWN number. The owner pairs that number once by scanning a
 * WhatsApp Web Multi-Device login QR; from then on the provider keeps the
 * session alive and we just push messages through it.
 *
 * NOTHING in the business logic may import a concrete provider — always go
 * through `getProvider()` (see ./index.ts). Swapping Evolution API for Baileys,
 * Green API, CodeChat, WAHA, … means writing one more file in this folder.
 *
 * Explicitly NOT used: Meta Business Cloud API, Business Verification,
 * Facebook Business Manager, App Review, message templates.
 */

/** One restaurant's WhatsApp session on the provider side. */
export interface WhatsappSession {
  businessId: string;
  /** Provider-side session/instance name, e.g. "ptc-<businessId>". */
  instanceId: string;
  /** Per-session API key (already DECRYPTED), when the provider issues one. */
  token?: string | null;
}

export type ConnectionState =
  | "DISCONNECTED"
  | "QR_PENDING" // login QR issued, waiting for the owner's phone to scan it
  | "CONNECTING" // scanned, session being established
  | "CONNECTED"
  | "ERROR";

/** Result of asking the provider to start (or resume) a login. */
export interface ConnectResult {
  state: ConnectionState;
  /** PNG data URL of the WhatsApp Web login QR, when one is pending. */
  qrDataUrl?: string;
  /** Some providers can pair with an 8-character code instead of a QR. */
  pairingCode?: string;
  /** Session token to persist (encrypted) when the provider just issued one. */
  token?: string;
  error?: string;
}

/** Live state of a paired session. */
export interface ProviderStatus {
  state: ConnectionState;
  /** The restaurant's own WhatsApp number in E.164 digits, once paired. */
  phoneNumber?: string;
  profileName?: string;
  error?: string;
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retriable: boolean };

/** Binary payload for image/document sends. */
export interface OutboundMedia {
  /** Base64 WITHOUT the `data:` prefix. */
  base64: string;
  mimeType: string;
  fileName: string;
}

/** Where the provider should POST session + message events for a business. */
export interface WebhookTarget {
  url: string;
}

export interface WhatsappProvider {
  /** Stable id persisted in WhatsAppConnection.provider. */
  readonly id: string;
  /** Human-readable name for the settings UI. */
  readonly label: string;
  /** False when the deployment is missing the provider's env configuration. */
  isConfigured(): boolean;

  /**
   * Start or resume a login for this session, creating the provider-side
   * instance if needed. Returns a QR to render when pairing is required, or
   * CONNECTED when the session is already alive.
   */
  connect(session: WhatsappSession, webhook?: WebhookTarget): Promise<ConnectResult>;

  /** Log the restaurant's number out and drop the provider-side session. */
  disconnect(session: WhatsappSession): Promise<void>;

  getStatus(session: WhatsappSession): Promise<ProviderStatus>;

  sendText(session: WhatsappSession, to: string, text: string): Promise<SendResult>;

  sendImage(
    session: WhatsappSession,
    to: string,
    image: OutboundMedia,
    caption?: string,
  ): Promise<SendResult>;

  sendDocument(
    session: WhatsappSession,
    to: string,
    document: OutboundMedia,
    caption?: string,
  ): Promise<SendResult>;
}
