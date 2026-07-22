// Pure points-calculation logic. No DB access here so it can be unit-tested.

export interface PointsRule {
  amountPerPoint: number; // EUR needed to earn `pointsPerUnit` points
  pointsPerUnit: number;
  rounding: "floor" | "round" | "ceil";
  minPointsPerTxn: number;
  maxPointsPerTxn?: number | null;
  tierMultiplier?: number; // membership tier multiplier, default 1
}

function applyRounding(value: number, mode: PointsRule["rounding"]): number {
  if (mode === "ceil") return Math.ceil(value);
  if (mode === "round") return Math.round(value);
  return Math.floor(value);
}

/**
 * Compute points earned for a purchase amount (EUR).
 * Example: amountPerPoint=1, pointsPerUnit=1 → 1€ = 1 point.
 *          amountPerPoint=10, pointsPerUnit=1 → 10€ = 1 point.
 */
export function calculateEarnedPoints(amount: number, rule: PointsRule): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (rule.amountPerPoint <= 0) return 0;

  const base = (amount / rule.amountPerPoint) * rule.pointsPerUnit;
  const withMultiplier = base * (rule.tierMultiplier ?? 1);
  let points = applyRounding(withMultiplier, rule.rounding);

  if (points < rule.minPointsPerTxn) points = rule.minPointsPerTxn;
  if (rule.maxPointsPerTxn != null && points > rule.maxPointsPerTxn) {
    points = rule.maxPointsPerTxn;
  }
  return Math.max(0, points);
}

export interface RedeemCheck {
  ok: boolean;
  reason?: "insufficient_points" | "invalid_cost";
}

/** Validate a redemption against the customer's current balance. */
export function canRedeem(balance: number, cost: number): RedeemCheck {
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: false, reason: "invalid_cost" };
  }
  if (balance < cost) {
    return { ok: false, reason: "insufficient_points" };
  }
  return { ok: true };
}
