// Marketing/display plan catalog. Mirrors the `Plan` rows created by the seed.
export interface PlanDisplay {
  tier: "BASIC" | "BUSINESS" | "PREMIUM";
  name: string;
  priceMonthly: number; // EUR
  tagline: string;
  highlighted?: boolean;
  limits: { branches: string; staff: string; customers: string };
  features: string[];
}

export const PLANS: PlanDisplay[] = [
  {
    tier: "BASIC",
    name: "Basic",
    priceMonthly: 19,
    tagline: "Cho quán nhỏ mới bắt đầu",
    limits: { branches: "1 chi nhánh", staff: "3 nhân viên", customers: "500 khách" },
    features: [
      "Tích điểm cơ bản",
      "Thẻ thành viên QR",
      "Voucher cơ bản",
      "Báo cáo cơ bản",
      "Quét QR không giới hạn",
    ],
  },
  {
    tier: "BUSINESS",
    name: "Business",
    priceMonthly: 49,
    tagline: "Cho doanh nghiệp đang phát triển",
    highlighted: true,
    limits: { branches: "3 chi nhánh", staff: "15 nhân viên", customers: "5.000 khách" },
    features: [
      "Tất cả gói Basic",
      "Membership tier (hạng thành viên)",
      "Chiến dịch marketing",
      "Báo cáo nâng cao",
      "Rewards catalog",
      "Chống gian lận nâng cao",
    ],
  },
  {
    tier: "PREMIUM",
    name: "Premium",
    priceMonthly: 99,
    tagline: "Cho chuỗi & thương hiệu",
    limits: {
      branches: "Không giới hạn",
      staff: "Không giới hạn",
      customers: "Không giới hạn",
    },
    features: [
      "Tất cả gói Business",
      "White-label & tên miền riêng",
      "Branding tùy chỉnh",
      "Priority support",
      "API & export nâng cao",
    ],
  },
];
