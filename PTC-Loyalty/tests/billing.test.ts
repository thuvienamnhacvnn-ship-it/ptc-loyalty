import { describe, it, expect } from "vitest";
import { addMonths, nextPeriodStart, isCollected } from "@/lib/billing";
import { PLANS, planPriceCents } from "@/lib/plans";

describe("addMonths", () => {
  it("advances by whole months", () => {
    expect(addMonths(new Date("2026-01-15T00:00:00Z"), 1).getMonth()).toBe(1);
  });

  it("clamps a 31st onto a short month instead of spilling over", () => {
    const result = addMonths(new Date(2026, 0, 31), 1); // 31 Jan 2026
    expect(result.getMonth()).toBe(1); // February, not March
    expect(result.getDate()).toBe(28); // 2026 is not a leap year
  });

  it("handles a leap-year February", () => {
    const result = addMonths(new Date(2028, 0, 31), 1); // 31 Jan 2028
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it("rolls across a year boundary", () => {
    const result = addMonths(new Date(2026, 10, 15), 3); // Nov 2026 + 3
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1); // February
  });

  it("supports multi-month prepayment", () => {
    const result = addMonths(new Date(2026, 0, 1), 12);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
  });
});

describe("nextPeriodStart", () => {
  it("continues from the current period end when still running", () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    expect(nextPeriodStart(future).getTime()).toBe(future.getTime());
  });

  it("starts today when the period already lapsed", () => {
    const past = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const start = nextPeriodStart(past);
    // A lapsed tenant must not be credited for the gap.
    expect(start.getTime()).toBeGreaterThan(past.getTime());
    expect(Math.abs(start.getTime() - Date.now())).toBeLessThan(5000);
  });

  it("starts today when there is no period yet", () => {
    expect(Math.abs(nextPeriodStart(null).getTime() - Date.now())).toBeLessThan(5000);
  });
});

describe("isCollected", () => {
  it("counts only PAID as money in the bank", () => {
    expect(isCollected("PAID")).toBe(true);
    expect(isCollected("PENDING")).toBe(false);
    expect(isCollected("FAILED")).toBe(false);
    expect(isCollected("REFUNDED")).toBe(false);
  });
});

describe("plan catalog", () => {
  it("prices the three tiers at 29 / 49 / 79 EUR", () => {
    expect(PLANS.map((p) => p.priceMonthly)).toEqual([29, 49, 79]);
  });

  it("converts to cents for the DB without float drift", () => {
    expect(planPriceCents("BASIC")).toBe(2900);
    expect(planPriceCents("BUSINESS")).toBe(4900);
    expect(planPriceCents("PREMIUM")).toBe(7900);
  });

  it("keeps tiers ordered cheapest first, matching the pricing page", () => {
    const prices = PLANS.map((p) => p.priceMonthly);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});
