// Locale-aware formatting for the German / EU market (default de-DE, EUR, Berlin).

const DEFAULT_LOCALE = "de-DE";
const TIMEZONE = "Europe/Berlin";

export function formatCurrency(
  amount: number,
  currency = "EUR",
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatNumber(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPoints(value: number, locale = DEFAULT_LOCALE): string {
  return `${new Intl.NumberFormat(locale).format(value)} P`;
}

export function formatDate(
  date: Date | string,
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

export function formatDateTime(
  date: Date | string,
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

export function formatRelative(
  date: Date | string,
  locale = DEFAULT_LOCALE,
): string {
  const d = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.round((d - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
