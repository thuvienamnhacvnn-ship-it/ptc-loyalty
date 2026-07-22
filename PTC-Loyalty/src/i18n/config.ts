export const locales = ["vi", "de", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "vi";

export const localeNames: Record<Locale, string> = {
  vi: "Tiếng Việt",
  de: "Deutsch",
  en: "English",
};
