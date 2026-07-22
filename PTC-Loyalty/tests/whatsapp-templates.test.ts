import { describe, it, expect } from "vitest";
import {
  renderBody,
  progressLine,
  normalizeLanguage,
  defaultTemplateRows,
  WA_LANGUAGES,
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

  it("provisions 3 keys × 3 languages = 9 templates", () => {
    const rows = defaultTemplateRows();
    expect(rows).toHaveLength(9);
    expect(new Set(rows.map((r) => r.language)).size).toBe(3);
  });
});
