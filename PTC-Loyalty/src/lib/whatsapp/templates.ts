// WhatsApp message copy in Vietnamese, German and English.
//
// These are ordinary chat messages sent from the restaurant's OWN WhatsApp
// number over a WhatsApp Web Multi-Device session — there is no template
// approval, no review queue and no 24-hour window to work around. The bodies
// live here so every business gets sensible defaults; a business may override
// any of them (WhatsAppTemplate rows).
//
// {{n}} placeholders are positional and documented per key below.

export type TemplateKey =
  | "welcome" // sent right after signup
  | "member_card" // caption of the membership-QR image
  | "points_earned"
  | "reward_redeemed"
  | "voucher";

export type WaLanguage = "vi" | "de" | "en";

export const WA_LANGUAGES: WaLanguage[] = ["vi", "de", "en"];

export const TEMPLATE_KEYS: TemplateKey[] = [
  "welcome",
  "member_card",
  "points_earned",
  "reward_redeemed",
  "voucher",
];

// Parameter order per key:
//   welcome:         1=store, 2=customer name, 3=member code, 4=member url
//   member_card:     1=store, 2=member code
//   points_earned:   1=store, 2=points earned, 3=balance, 4=progress line, 5=member url
//   reward_redeemed: 1=store, 2=points spent, 3=balance, 4=member url
//   voucher:         1=store, 2=voucher title, 3=member url
const BODIES: Record<TemplateKey, Record<WaLanguage, string>> = {
  welcome: {
    vi: "🎉 Chào mừng {{2}} đến với *{{1}}*!\n\nBạn đã trở thành thành viên tích điểm.\nMã thành viên: *{{3}}*\n\nMỗi lần ghé {{1}}, bạn sẽ được cộng điểm và nhận ưu đãi riêng.\nXem tài khoản của bạn: {{4}}",
    de: "🎉 Willkommen {{2}} bei *{{1}}*!\n\nSie sind jetzt Mitglied unseres Bonusprogramms.\nMitgliedsnummer: *{{3}}*\n\nBei jedem Besuch sammeln Sie Punkte und erhalten persönliche Vorteile.\nKonto ansehen: {{4}}",
    en: "🎉 Welcome {{2}} to *{{1}}*!\n\nYou're now a loyalty member.\nMember code: *{{3}}*\n\nEvery visit earns you points and personal rewards.\nView your account: {{4}}",
  },
  member_card: {
    vi: "📲 Đây là mã QR thành viên của bạn tại *{{1}}* (mã: {{2}}).\n\nCách dùng:\n1️⃣ Lưu ảnh này vào điện thoại.\n2️⃣ Mỗi lần đến, đưa mã QR cho nhân viên quét.\n3️⃣ Điểm được cộng ngay lập tức.\n\nHẹn gặp lại bạn! ❤️",
    de: "📲 Das ist Ihr Mitglieds-QR-Code bei *{{1}}* (Nr. {{2}}).\n\nSo funktioniert's:\n1️⃣ Speichern Sie dieses Bild auf Ihrem Handy.\n2️⃣ Zeigen Sie den QR-Code bei jedem Besuch vor.\n3️⃣ Ihre Punkte werden sofort gutgeschrieben.\n\nBis bald! ❤️",
    en: "📲 This is your membership QR code at *{{1}}* (code: {{2}}).\n\nHow to use it:\n1️⃣ Save this image to your phone.\n2️⃣ Show the QR code to our staff on every visit.\n3️⃣ Your points are added instantly.\n\nSee you soon! ❤️",
  },
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
  return render(templateBody(key, lang), params);
}

/** Substitute placeholders in an arbitrary body (e.g. a business override). */
export function render(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_m, i) => params[Number(i) - 1] ?? "");
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

/** Default message rows to provision for a business (key × language). */
export function defaultTemplateRows() {
  const rows: { key: TemplateKey; language: WaLanguage; body: string }[] = [];
  for (const key of TEMPLATE_KEYS) {
    for (const language of WA_LANGUAGES) {
      rows.push({ key, language, body: templateBody(key, language) });
    }
  }
  return rows;
}
