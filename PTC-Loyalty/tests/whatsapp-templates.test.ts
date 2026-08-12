import { describe, it, expect } from "vitest";
import {
  renderBody,
  progressLine,
  normalizeLanguage,
  defaultTemplateRows,
  WA_LANGUAGES,
  TEMPLATE_KEYS,
} from "@/lib/whatsapp/templates";

describe("WhatsApp templates", () => {
  it("renders points_earned with ordered params in all languages", () => {
    const params = ["Phở Hà Nội", "25", "125", "Còn 75 điểm nữa.", "https://x/member"];
    for (const lang of WA_LANGUAGES) {
      const body = renderBody("points_earned", lang, params);
      expect(body).toContain("Phở Hà Nội");
      expect(body).toContain("25");
      expect(body).toContain("125");
      expect(body).toContain("https://x/member");
      expect(body).not.toMatch(/\{\{\d+\}\}/); // no unresolved placeholders
    }
  });

  it("localises the progress line per language", () => {
    expect(progressLine("vi", { kind: "reward", points: 50, label: "Phở bò" })).toContain("50");
    expect(progressLine("de", { kind: "tier", points: 100, label: "Gold" })).toContain("Gold");
    expect(progressLine("en", { kind: "max" })).toMatch(/top tier/i);
  });

  it("normalises unknown locales to vi", () => {
    expect(normalizeLanguage("fr")).toBe("vi");
    expect(normalizeLanguage("de")).toBe("de");
    expect(normalizeLanguage(null)).toBe("vi");
  });

  it("renders the signup welcome + QR caption in all languages", () => {
    for (const lang of WA_LANGUAGES) {
      const welcome = renderBody("welcome", lang, [
        "Phở Hà Nội",
        "Nguyễn An",
        "PTC-1234",
        "https://x/member",
      ]);
      expect(welcome).toContain("Nguyễn An");
      expect(welcome).toContain("PTC-1234");
      expect(welcome).not.toMatch(/\{\{\d+\}\}/);

      const caption = renderBody("member_card", lang, ["Phở Hà Nội", "PTC-1234"]);
      expect(caption).toContain("Phở Hà Nội");
      expect(caption).not.toMatch(/\{\{\d+\}\}/);
    }
  });

  it("provisions every key × 3 languages", () => {
    const rows = defaultTemplateRows();
    expect(rows).toHaveLength(TEMPLATE_KEYS.length * WA_LANGUAGES.length);
    expect(new Set(rows.map((r) => r.language)).size).toBe(3);
    expect(rows.every((r) => r.body.length > 0)).toBe(true);
    // Ba mẫu tin lịch hẹn phải nằm trong bộ mặc định, nếu không quán mới sẽ
    // không có nội dung để sửa trong trang cài đặt WhatsApp.
    for (const key of ["appointment_confirmed", "appointment_reminder", "appointment_cancelled"]) {
      expect(rows.filter((r) => r.key === key)).toHaveLength(3);
    }
  });
});
