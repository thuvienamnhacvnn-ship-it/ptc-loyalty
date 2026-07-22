// WhatsApp message templates in Vietnamese, German and English.
//
// Meta requires business-initiated messages to use PRE-APPROVED templates
// (submitted in WhatsApp Manager). We keep the canonical body text here so we
// can render local previews / the "test message" and know the parameter order
// that must match the approved template. `metaTemplateName` is the name Meta
// knows the template by.

export type TemplateKey = "points_earned" | "reward_redeemed" | "voucher";
export type WaLanguage = "vi" | "de" | "en";

export const WA_LANGUAGES: WaLanguage[] = ["vi", "de", "en"];

// Meta uses BCP-47-ish locale codes for template languages.
export const META_LOCALE: Record<WaLanguage, string> = {
  vi: "vi",
  de: "de",
  en: "en",
};

export const DEFAULT_META_TEMPLATE_NAME: Record<TemplateKey, string> = {
  points_earned: "ptc_points_earned",
  reward_redeemed: "ptc_reward_redeemed",
  voucher: "ptc_voucher_new",
};

export const TEMPLATE_CATEGORY: Record<TemplateKey, string> = {
  points_earned: "UTILITY",
  reward_redeemed: "UTILITY",
  voucher: "MARKETING",
};

// Body text with {{n}} placeholders. Parameter order is the contract with Meta.
// points_earned: 1=store, 2=points earned, 3=total balance, 4=progress line, 5=member url
// reward_redeemed: 1=store, 2=points spent, 3=balance, 4=member url
// voucher: 1=store, 2=voucher title, 3=member url
const BODIES: Record<TemplateKey, Record<WaLanguage, string>> = {
  points_earned: {
    vi: "🎉 {{1}}: Bạn vừa nhận {{2}} điểm!\nTổng điểm hiện tại: {{3}}.\n{{4}}\nXem tài khoản của bạn: {{5}}",
    de: "🎉 {{1}}: Sie haben {{2}} Punkte erhalten!\nAktueller Punktestand: {{3}}.\n{{4}}\nKonto ansehen: {{5}}",
    en: "🎉 {{1}}: You just earned {{2}} points!\nCurrent balance: {{3}}.\n{{4}}\nView your account: {{5}}",
  },
  reward_redeemed: {
    vi: "✅ {{1}}: Đổi thưởng thành công (-{{2}} điểm).\nSố dư còn lại: {{3}}.\nXem tài khoản của bạn: {{4}}",
    de: "✅ {{1}}: Prämie eingelöst (-{{2}} Punkte).\nVerbleibender Punktestand: {{3}}.\nKonto ansehen: {{4}}",
    en: "✅ {{1}}: Reward redeemed (-{{2}} points).\nRemaining balance: {{3}}.\nView your account: {{4}}",
  },
  voucher: {
    vi: "🎁 {{1}}: Bạn có voucher mới: {{2}}.\nXem tài khoản của bạn: {{3}}",
    de: "🎁 {{1}}: Sie haben einen neuen Gutschein: {{2}}.\nKonto ansehen: {{3}}",
    en: "🎁 {{1}}: You have a new voucher: {{2}}.\nView your account: {{3}}",
  },
};

export function templateBody(key: TemplateKey, lang: WaLanguage): string {
  return BODIES[key][lang] ?? BODIES[key].en;
}

/** Substitute {{1}}, {{2}}, … with the given ordered parameters. */
export function renderBody(
  key: TemplateKey,
  lang: WaLanguage,
  params: string[],
): string {
  return templateBody(key, lang).replace(/\{\{(\d+)\}\}/g, (_m, i) => {
    return params[Number(i) - 1] ?? "";
  });
}

/** Localised "points remaining" line used as the progress parameter. */
export function progressLine(
  lang: WaLanguage,
  info:
    | { kind: "reward"; points: number; label: string }
    | { kind: "tier"; points: number; label: string }
    | { kind: "max" },
): string {
  if (info.kind === "max") {
    return {
      vi: "Bạn đang ở hạng cao nhất — cảm ơn bạn! 💛",
      de: "Sie haben die höchste Stufe erreicht — vielen Dank! 💛",
      en: "You're at the top tier — thank you! 💛",
    }[lang];
  }
  if (info.kind === "reward") {
    return {
      vi: `Còn ${info.points} điểm nữa để đổi "${info.label}".`,
      de: `Noch ${info.points} Punkte bis zur Prämie "${info.label}".`,
      en: `${info.points} more points to redeem "${info.label}".`,
    }[lang];
  }
  return {
    vi: `Còn ${info.points} điểm nữa để lên hạng ${info.label}.`,
    de: `Noch ${info.points} Punkte bis zur Stufe ${info.label}.`,
    en: `${info.points} more points to reach ${info.label} tier.`,
  }[lang];
}

export function normalizeLanguage(locale: string | null | undefined): WaLanguage {
  if (locale === "de" || locale === "en" || locale === "vi") return locale;
  return "vi";
}

/** Default template rows to provision for a business (key × language). */
export function defaultTemplateRows() {
  const rows: {
    key: TemplateKey;
    language: WaLanguage;
    metaTemplateName: string;
    category: string;
    bodyPreview: string;
  }[] = [];
  for (const key of Object.keys(BODIES) as TemplateKey[]) {
    for (const language of WA_LANGUAGES) {
      rows.push({
        key,
        language,
        metaTemplateName: DEFAULT_META_TEMPLATE_NAME[key],
        category: TEMPLATE_CATEGORY[key],
        bodyPreview: templateBody(key, language),
      });
    }
  }
  return rows;
}
