import { describe, it, expect } from "vitest";
import {
  checkCompliance,
  computeWorked,
  earlyLeaveMinutes,
  formatDuration,
  formatHhMm,
  lateMinutes,
  legalBreakMinutes,
  localDateKey,
  minutesFromMidnightInTz,
  parseHhMm,
  roundMinutes,
  shiftSpanMinutes,
  wageCents,
} from "@/lib/worktime";

const BREAK_RULE = { breakAfter6h: 30, breakAfter9h: 45 };

describe("giờ dạng chuỗi", () => {
  it("đọc và in lại đúng", () => {
    expect(parseHhMm("08:30")).toBe(510);
    expect(parseHhMm("00:00")).toBe(0);
    expect(parseHhMm("23:59")).toBe(1439);
    expect(formatHhMm(510)).toBe("08:30");
  });

  it("từ chối giờ vô nghĩa", () => {
    expect(parseHhMm("24:00")).toBeNull();
    expect(parseHhMm("08:60")).toBeNull();
    expect(parseHhMm("tám giờ")).toBeNull();
  });

  it("cuộn phút vượt một ngày khi in ca qua đêm", () => {
    expect(formatHhMm(1500)).toBe("01:00");
  });
});

describe("độ dài ca", () => {
  it("ca ban ngày", () => {
    expect(shiftSpanMinutes(8 * 60, 16 * 60)).toBe(480);
  });

  // Đây là chỗ dễ sai nhất: ca bếp 18:00–02:00 trừ thẳng ra số âm.
  it("ca qua đêm không ra số âm", () => {
    expect(shiftSpanMinutes(18 * 60, 2 * 60)).toBe(8 * 60);
    expect(shiftSpanMinutes(22 * 60, 6 * 60)).toBe(8 * 60);
  });
});

describe("giờ nghỉ theo luật", () => {
  it("dưới 6 tiếng thì không bắt buộc nghỉ", () => {
    expect(legalBreakMinutes(6 * 60, BREAK_RULE)).toBe(0);
  });

  it("trên 6 tiếng phải nghỉ 30 phút", () => {
    expect(legalBreakMinutes(6 * 60 + 1, BREAK_RULE)).toBe(30);
    expect(legalBreakMinutes(9 * 60, BREAK_RULE)).toBe(30);
  });

  it("trên 9 tiếng phải nghỉ 45 phút", () => {
    expect(legalBreakMinutes(9 * 60 + 1, BREAK_RULE)).toBe(45);
  });
});

describe("giờ công một lần chấm", () => {
  const base = {
    breakMin: 0,
    autoDeductBreak: true,
    breakRule: BREAK_RULE,
    roundingMin: 0,
  };

  it("ca chưa quét ra thì chưa có giờ công", () => {
    const r = computeWorked({
      ...base,
      clockInAt: new Date("2026-08-24T08:00:00Z"),
      clockOutAt: null,
    });
    expect(r.workedMin).toBe(0);
  });

  it("ca 8 tiếng bị trừ 30 phút nghỉ theo luật", () => {
    const r = computeWorked({
      ...base,
      clockInAt: new Date("2026-08-24T08:00:00Z"),
      clockOutAt: new Date("2026-08-24T16:00:00Z"),
    });
    expect(r.presentMin).toBe(480);
    expect(r.breakMin).toBe(30);
    expect(r.workedMin).toBe(450);
  });

  it("nghỉ đã ghi nhiều hơn luật thì giữ số đã ghi", () => {
    const r = computeWorked({
      ...base,
      breakMin: 60,
      clockInAt: new Date("2026-08-24T08:00:00Z"),
      clockOutAt: new Date("2026-08-24T16:00:00Z"),
    });
    expect(r.breakMin).toBe(60);
    expect(r.workedMin).toBe(420);
  });

  it("tắt tự trừ thì tôn trọng đúng số nhân viên bấm", () => {
    const r = computeWorked({
      ...base,
      autoDeductBreak: false,
      clockInAt: new Date("2026-08-24T08:00:00Z"),
      clockOutAt: new Date("2026-08-24T16:00:00Z"),
    });
    expect(r.breakMin).toBe(0);
    expect(r.workedMin).toBe(480);
  });

  it("ca ngắn hơn giờ nghỉ vẫn không ra giờ công âm", () => {
    const r = computeWorked({
      ...base,
      breakMin: 60,
      clockInAt: new Date("2026-08-24T08:00:00Z"),
      clockOutAt: new Date("2026-08-24T08:20:00Z"),
    });
    expect(r.workedMin).toBe(0);
  });

  it("làm tròn theo bội số phút", () => {
    const r = computeWorked({
      ...base,
      autoDeductBreak: false,
      roundingMin: 15,
      clockInAt: new Date("2026-08-24T08:00:00Z"),
      clockOutAt: new Date("2026-08-24T12:07:00Z"),
    });
    expect(r.workedMin).toBe(240); // 247 phút → làm tròn về 4 tiếng
  });

  it("ca qua đêm tính đủ giờ", () => {
    const r = computeWorked({
      ...base,
      autoDeductBreak: false,
      clockInAt: new Date("2026-08-24T20:00:00Z"),
      clockOutAt: new Date("2026-08-25T02:00:00Z"),
    });
    expect(r.workedMin).toBe(360);
  });
});

describe("làm tròn", () => {
  it("bước 0 thì giữ nguyên", () => {
    expect(roundMinutes(247, 0)).toBe(247);
  });
  it("bước 15", () => {
    expect(roundMinutes(247, 15)).toBe(240);
    expect(roundMinutes(253, 15)).toBe(255);
  });
});

describe("đi muộn và về sớm", () => {
  it("trong khoảng dung sai coi như đúng giờ", () => {
    expect(lateMinutes({ actualMinute: 488, plannedMinute: 480, toleranceMin: 10 })).toBe(0);
  });

  it("quá dung sai thì tính đủ số phút, không trừ đi dung sai", () => {
    expect(lateMinutes({ actualMinute: 500, plannedMinute: 480, toleranceMin: 10 })).toBe(20);
  });

  it("đến sớm không thành số âm", () => {
    expect(lateMinutes({ actualMinute: 450, plannedMinute: 480, toleranceMin: 10 })).toBe(0);
  });

  it("về sớm tính đúng", () => {
    expect(earlyLeaveMinutes({ actualMinute: 940, plannedMinute: 960, toleranceMin: 10 })).toBe(20);
  });

  it("ở lại muộn không tính là về sớm", () => {
    expect(earlyLeaveMinutes({ actualMinute: 1000, plannedMinute: 960, toleranceMin: 10 })).toBe(0);
  });

  // Quét ra lúc 00:10 so với ca kết thúc 23:55: trừ thẳng ra −1425 phút,
  // tức là "về sớm gần 24 tiếng". Phải hiểu đúng là muộn 15 phút.
  it("ca đêm vắt qua nửa đêm không bị hiểu thành về sớm cả ngày", () => {
    expect(earlyLeaveMinutes({ actualMinute: 10, plannedMinute: 1435, toleranceMin: 10 })).toBe(0);
    expect(lateMinutes({ actualMinute: 10, plannedMinute: 1435, toleranceMin: 10 })).toBe(15);
  });
});

describe("soi theo luật giờ làm việc", () => {
  const base = {
    breakMin: 45,
    breakRule: BREAK_RULE,
    maxDailyHours: 10,
    restBeforeMin: null,
    minRestHours: 11,
  };

  it("ngày làm bình thường thì không có cảnh báo", () => {
    expect(checkCompliance({ ...base, workedMin: 450, breakMin: 30 })).toHaveLength(0);
  });

  it("quá 10 tiếng một ngày", () => {
    const issues = checkCompliance({ ...base, workedMin: 11 * 60 });
    expect(issues.map((i) => i.code)).toContain("OVER_DAILY_LIMIT");
  });

  it("nghỉ ít hơn luật", () => {
    const issues = checkCompliance({ ...base, workedMin: 8 * 60, breakMin: 10 });
    expect(issues.map((i) => i.code)).toContain("BREAK_TOO_SHORT");
  });

  it("nghỉ giữa hai ca dưới 11 tiếng", () => {
    const issues = checkCompliance({ ...base, workedMin: 400, restBeforeMin: 8 * 60 });
    expect(issues.map((i) => i.code)).toContain("REST_TOO_SHORT");
  });
});

describe("đọc giờ theo múi giờ của quán", () => {
  // Berlin mùa hè là UTC+2, nên 06:00 UTC là 08:00 ở quán.
  it("giờ mùa hè", () => {
    const at = new Date("2026-08-24T06:00:00Z");
    expect(minutesFromMidnightInTz(at, "Europe/Berlin")).toBe(8 * 60);
    expect(localDateKey(at, "Europe/Berlin")).toBe("2026-08-24");
  });

  // Mùa đông là UTC+1 — cùng một mốc UTC ra giờ quán khác nhau. Cộng offset
  // cứng là sai đúng vào tuần chuyển mùa.
  it("giờ mùa đông", () => {
    const at = new Date("2026-01-15T06:00:00Z");
    expect(minutesFromMidnightInTz(at, "Europe/Berlin")).toBe(7 * 60);
  });

  it("quá nửa đêm ở Berlin đã là ngày hôm sau", () => {
    const at = new Date("2026-08-24T23:30:00Z"); // 01:30 ngày 25 ở Berlin
    expect(localDateKey(at, "Europe/Berlin")).toBe("2026-08-25");
    expect(minutesFromMidnightInTz(at, "Europe/Berlin")).toBe(90);
  });
});

describe("hiển thị và lương", () => {
  it("định dạng thời lượng", () => {
    expect(formatDuration(505)).toBe("8h25");
    expect(formatDuration(480)).toBe("8h");
    expect(formatDuration(-90)).toBe("-1h30");
  });

  it("quy giờ công ra tiền", () => {
    expect(wageCents(450, 1350)).toBe(10125); // 7,5 tiếng × 13,50 € = 101,25 €
    expect(wageCents(450, null)).toBeNull();
  });
});
