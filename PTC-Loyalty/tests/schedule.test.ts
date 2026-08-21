import { describe, it, expect } from "vitest";
import {
  absenceDayCount,
  addDays,
  dateKeyToUtcDate,
  findBlockingAbsence,
  mondayOf,
  restGapMinutes,
  shiftsOverlap,
  toAbsoluteRange,
  utcDateToKey,
  weekDateKeys,
} from "@/lib/schedule";

describe("trùng ca", () => {
  const morning = { dateKey: "2026-08-24", startMinute: 8 * 60, endMinute: 16 * 60 };

  it("hai ca cách nhau thì không đè", () => {
    expect(
      shiftsOverlap(morning, { dateKey: "2026-08-24", startMinute: 17 * 60, endMinute: 22 * 60 }),
    ).toBe(false);
  });

  // Ca sáng kết thúc 16:00 và ca chiều bắt đầu 16:00 là chuyện bình thường ở
  // quán ăn — giao ca. Không được coi là trùng.
  it("chạm đầu đuôi không tính là đè", () => {
    expect(
      shiftsOverlap(morning, { dateKey: "2026-08-24", startMinute: 16 * 60, endMinute: 22 * 60 }),
    ).toBe(false);
  });

  it("gối lên nhau thì đè", () => {
    expect(
      shiftsOverlap(morning, { dateKey: "2026-08-24", startMinute: 15 * 60, endMinute: 20 * 60 }),
    ).toBe(true);
  });

  it("khác ngày thì không đè", () => {
    expect(
      shiftsOverlap(morning, { dateKey: "2026-08-25", startMinute: 8 * 60, endMinute: 16 * 60 }),
    ).toBe(false);
  });

  // Ca đêm 18:00–02:00 kéo sang ngày hôm sau. So bằng phút trần thì nó trông
  // như không chạm ai; phải duỗi thành khoảng tuyệt đối mới thấy.
  it("ca đêm đè lên ca sáng hôm sau", () => {
    const night = { dateKey: "2026-08-24", startMinute: 18 * 60, endMinute: 2 * 60 };
    const nextMorning = { dateKey: "2026-08-25", startMinute: 1 * 60, endMinute: 9 * 60 };
    expect(shiftsOverlap(night, nextMorning)).toBe(true);
  });

  it("ca đêm không đè lên ca bắt đầu sau khi nó kết thúc", () => {
    const night = { dateKey: "2026-08-24", startMinute: 18 * 60, endMinute: 2 * 60 };
    const nextMorning = { dateKey: "2026-08-25", startMinute: 8 * 60, endMinute: 16 * 60 };
    expect(shiftsOverlap(night, nextMorning)).toBe(false);
  });
});

describe("khoảng nghỉ giữa hai ca", () => {
  it("tính đúng số tiếng nghỉ", () => {
    const evening = { dateKey: "2026-08-24", startMinute: 16 * 60, endMinute: 23 * 60 };
    const morning = { dateKey: "2026-08-25", startMinute: 8 * 60, endMinute: 16 * 60 };
    expect(restGapMinutes(evening, morning)).toBe(9 * 60);
  });

  it("hai ca đè nhau ra số âm", () => {
    const a = { dateKey: "2026-08-24", startMinute: 8 * 60, endMinute: 16 * 60 };
    const b = { dateKey: "2026-08-24", startMinute: 14 * 60, endMinute: 20 * 60 };
    expect(restGapMinutes(a, b)).toBeLessThan(0);
  });
});

describe("khoảng tuyệt đối", () => {
  it("ca qua đêm kết thúc ở ngày hôm sau", () => {
    const r = toAbsoluteRange({ dateKey: "2026-08-24", startMinute: 18 * 60, endMinute: 2 * 60 });
    expect(r.end - r.start).toBe(8 * 60);
  });
});

describe("chặn xếp ca vì đang nghỉ", () => {
  const absences = [{ startDateKey: "2026-08-24", endDateKey: "2026-08-26" }];

  it("ngày đầu kỳ nghỉ bị chặn", () => {
    expect(findBlockingAbsence("2026-08-24", absences)).not.toBeNull();
  });

  it("ngày cuối kỳ nghỉ cũng bị chặn", () => {
    expect(findBlockingAbsence("2026-08-26", absences)).not.toBeNull();
  });

  it("ngày giữa bị chặn", () => {
    expect(findBlockingAbsence("2026-08-25", absences)).not.toBeNull();
  });

  it("ngày ngoài kỳ nghỉ thì xếp được", () => {
    expect(findBlockingAbsence("2026-08-23", absences)).toBeNull();
    expect(findBlockingAbsence("2026-08-27", absences)).toBeNull();
  });

  it("không có kỳ nghỉ nào thì không chặn", () => {
    expect(findBlockingAbsence("2026-08-24", [])).toBeNull();
  });
});

describe("số ngày nghỉ", () => {
  it("báo ốm một ngày là một ngày, không phải không ngày", () => {
    expect(absenceDayCount({ startDateKey: "2026-08-24", endDateKey: "2026-08-24" })).toBe(1);
  });

  it("tính cả hai đầu", () => {
    expect(absenceDayCount({ startDateKey: "2026-08-24", endDateKey: "2026-08-26" })).toBe(3);
  });

  it("ngày ngược thì trả 0", () => {
    expect(absenceDayCount({ startDateKey: "2026-08-26", endDateKey: "2026-08-24" })).toBe(0);
  });
});

describe("tuần bắt đầu từ thứ Hai", () => {
  it("giữa tuần lùi về thứ Hai", () => {
    // 2026-08-26 là thứ Tư.
    expect(mondayOf("2026-08-26")).toBe("2026-08-24");
  });

  it("chủ nhật thuộc về tuần đang chạy, không phải tuần sau", () => {
    expect(mondayOf("2026-08-30")).toBe("2026-08-24");
  });

  it("thứ Hai thì giữ nguyên", () => {
    expect(mondayOf("2026-08-24")).toBe("2026-08-24");
  });

  it("một tuần có bảy ngày liên tiếp", () => {
    const keys = weekDateKeys("2026-08-24");
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-08-24");
    expect(keys[6]).toBe("2026-08-30");
  });
});

describe("cộng ngày và đổi kiểu ngày", () => {
  it("cộng qua ranh giới tháng", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  // Cột @db.Date phải là nửa đêm UTC. Dùng new Date(y, m, d) sẽ lùi một ngày ở
  // múi giờ dương, làm ca thứ Hai nhảy về chủ nhật.
  it("đổi qua lại không lệch ngày", () => {
    const d = dateKeyToUtcDate("2026-08-24");
    expect(d.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(utcDateToKey(d)).toBe("2026-08-24");
  });
});
