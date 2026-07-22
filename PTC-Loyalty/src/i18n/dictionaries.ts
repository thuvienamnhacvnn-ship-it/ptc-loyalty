import type { Locale } from "./config";

// Lightweight dictionary. Extend freely — keys are shared across locales.
const dictionaries = {
  vi: {
    "nav.features": "Tính năng",
    "nav.pricing": "Bảng giá",
    "nav.login": "Đăng nhập",
    "nav.register": "Đăng ký",
    "landing.hero.title": "Nền tảng khách hàng thân thiết cho doanh nghiệp Việt tại Đức",
    "landing.hero.subtitle":
      "Tích điểm, voucher, thẻ thành viên QR và báo cáo — tất cả trong một hệ thống. Khách không cần tải app.",
    "landing.cta.start": "Bắt đầu miễn phí",
    "landing.cta.demo": "Xem demo",
    "common.points": "điểm",
    "common.save": "Lưu",
    "common.cancel": "Hủy",
    "common.loading": "Đang tải...",
  },
  de: {
    "nav.features": "Funktionen",
    "nav.pricing": "Preise",
    "nav.login": "Anmelden",
    "nav.register": "Registrieren",
    "landing.hero.title": "Treueplattform für vietnamesische Unternehmen in Deutschland",
    "landing.hero.subtitle":
      "Punkte, Gutscheine, QR-Mitgliedskarten und Berichte — alles in einem System. Ohne App für Kunden.",
    "landing.cta.start": "Kostenlos starten",
    "landing.cta.demo": "Demo ansehen",
    "common.points": "Punkte",
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.loading": "Wird geladen...",
  },
  en: {
    "nav.features": "Features",
    "nav.pricing": "Pricing",
    "nav.login": "Log in",
    "nav.register": "Sign up",
    "landing.hero.title": "The loyalty platform for Vietnamese businesses in Germany",
    "landing.hero.subtitle":
      "Points, vouchers, QR membership cards and reports — all in one system. No app required for customers.",
    "landing.cta.start": "Start for free",
    "landing.cta.demo": "See demo",
    "common.points": "points",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.loading": "Loading...",
  },
} as const;

export type TranslationKey = keyof (typeof dictionaries)["vi"];

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries.vi;
}

export function t(locale: Locale, key: TranslationKey): string {
  return getDictionary(locale)[key] ?? key;
}
