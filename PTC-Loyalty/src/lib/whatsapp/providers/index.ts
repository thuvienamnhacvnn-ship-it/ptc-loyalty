import { evolutionProvider } from "./evolution";
import { logProvider } from "./log";
import type { WhatsappProvider } from "./types";

export type * from "./types";

/**
 * Provider registry. Adding Baileys / Green API / CodeChat / WAHA means writing
 * one file that implements WhatsappProvider and listing it here — no business
 * logic changes.
 */
const PROVIDERS: Record<string, WhatsappProvider> = {
  [evolutionProvider.id]: evolutionProvider,
  [logProvider.id]: logProvider,
};

/** Deployment-wide default, overridable per business row. */
export function defaultProviderId(): string {
  const configured = process.env.WHATSAPP_PROVIDER?.trim();
  if (configured && PROVIDERS[configured]) return configured;
  // Fall back to the no-op dev provider when the real gateway isn't configured,
  // so a local checkout never hard-fails on a missing EVOLUTION_API_URL.
  return evolutionProvider.isConfigured() ? evolutionProvider.id : logProvider.id;
}

/**
 * Resolve a provider by id.
 *
 * An explicitly set WHATSAPP_PROVIDER wins over whatever a row stored: that is
 * how an operator moves every tenant to another gateway — or to the dev stub —
 * without rewriting rows. There is deliberately NO silent fallback when the
 * stored provider is unconfigured: quietly rerouting messages through a
 * different channel (or the no-op stub) would report "sent" for a message
 * nobody received.
 */
export function getProvider(id?: string | null): WhatsappProvider {
  const override = process.env.WHATSAPP_PROVIDER?.trim();
  if (override && PROVIDERS[override]) return PROVIDERS[override];
  return PROVIDERS[id ?? ""] ?? PROVIDERS[defaultProviderId()];
}

export function listProviders(): WhatsappProvider[] {
  return Object.values(PROVIDERS);
}
