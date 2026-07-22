const LOCALE = "de-DE";

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

export function formatCurrency(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(n);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

/** Parse a "12,50" / "12.50" money string into a number, or NaN. */
export function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\s/g, "").replace(",", "."));
}

export function uuid(): string {
  return crypto.randomUUID();
}
