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

/** Resolve a provider by id, falling back to the deployment default. */
export function getProvider(id?: string | null): WhatsappProvider {
  return PROVIDERS[id ?? ""] ?? PROVIDERS[defaultProviderId()];
}

export function listProviders(): WhatsappProvider[] {
  return Object.values(PROVIDERS);
}
