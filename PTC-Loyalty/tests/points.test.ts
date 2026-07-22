import { describe, it, expect } from "vitest";
import { calculateEarnedPoints, canRedeem, type PointsRule } from "@/lib/points";

const base: PointsRule = {
  amountPerPoint: 1,
  pointsPerUnit: 1,
  rounding: "floor",
  minPointsPerTxn: 0,
  maxPointsPerTxn: null,
};

describe("calculateEarnedPoints", () => {
  it("1€ = 1 point", () => {
    expect(calculateEarnedPoints(25, base)).toBe(25);
  });

  it("10€ = 1 point rounds down", () => {
    expect(calculateEarnedPoints(25, { ...base, amountPerPoint: 10 })).toBe(2);
  });

  it("applies tier multiplier", () => {
    expect(calculateEarnedPoints(100, { ...base, tierMultiplier: 1.25 })).toBe(125);
  });

  it("respects max points per transaction", () => {
    expect(calculateEarnedPoints(1000, { ...base, maxPointsPerTxn: 100 })).toBe(100);
  });

  it("respects minimum points per transaction", () => {
    expect(calculateEarnedPoints(1, { ...base, amountPerPoint: 10, minPointsPerTxn: 5 })).toBe(5);
  });

  it("returns 0 for non-positive amounts", () => {
    expect(calculateEarnedPoints(0, base)).toBe(0);
    expect(calculateEarnedPoints(-10, base)).toBe(0);
  });

  it("rounding modes", () => {
    expect(calculateEarnedPoints(25, { ...base, amountPerPoint: 10, rounding: "ceil" })).toBe(3);
    expect(calculateEarnedPoints(25, { ...base, amountPerPoint: 10, rounding: "round" })).toBe(3);
    expect(calculateEarnedPoints(24, { ...base, amountPerPoint: 10, rounding: "round" })).toBe(2);
  });
});

describe("canRedeem", () => {
  it("allows redemption with sufficient balance", () => {
    expect(canRedeem(500, 300)).toEqual({ ok: true });
  });
  it("blocks redemption with insufficient balance", () => {
    expect(canRedeem(100, 300)).toEqual({ ok: false, reason: "insufficient_points" });
  });
  it("rejects invalid cost", () => {
    expect(canRedeem(100, 0)).toEqual({ ok: false, reason: "invalid_cost" });
    expect(canRedeem(100, -5)).toEqual({ ok: false, reason: "invalid_cost" });
  });
});
