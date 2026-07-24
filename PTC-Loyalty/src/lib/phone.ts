/**
 * Normalise a phone number to WhatsApp's international, digits-only form (no "+").
 *
 * Rules:
 *  - keep digits only;
 *  - a leading "+" or "00" international prefix is stripped;
 *  - a leading single "0" (a local/national number) is treated as GERMAN and
 *    replaced with the country code 49 — e.g. 015212345678 → 4915212345678;
 *  - returns null when the result isn't a plausible E.164 number (8–15 digits),
 *    so callers can show "Số điện thoại WhatsApp không hợp lệ."
 *
 * Client-safe (no server/Node dependencies) so it can run in the browser for the
 * manual "Gửi qua WhatsApp" (wa.me) flow.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "49" + d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) return null;
  return d;
}
