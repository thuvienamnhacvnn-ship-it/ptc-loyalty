// Transaction type → Vietnamese label + a colour class based on sign, shared by
// the Overview and Transactions screens.

const LABELS: Record<string, string> = {
  EARN: "Tích điểm",
  REDEEM: "Đổi điểm",
  BONUS: "Thưởng",
  REFUND: "Hoàn điểm",
  ADJUSTMENT: "Điều chỉnh",
  EXPIRE: "Hết hạn",
  REFERRAL: "Giới thiệu",
  BIRTHDAY: "Sinh nhật",
};

export function txLabel(type: string): string {
  return LABELS[type] ?? type;
}

/** CSS colour var for a signed points delta. */
export function txColor(points: number): string {
  return points >= 0 ? "var(--success)" : "var(--danger)";
}
