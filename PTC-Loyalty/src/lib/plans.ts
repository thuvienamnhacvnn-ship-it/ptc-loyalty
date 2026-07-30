/**
 * Single source of truth for the subscription catalog.
 *
 * Both the marketing pages (EUR, Vietnamese copy) and the `Plan` rows in the
 * database (cents, feature keys, quotas) are derived from this list —
 * `ensurePlans()` in `src/lib/provision.ts` upserts straight from it, so a price
 * edited here reaches the DB the next time a plan sync runs. Keep
 * `prisma/seed.ts` in step manually: tsx cannot resolve the `@/` alias, so the
 * seed carries its own copy of these numbers.
 */
export interface PlanDisplay {
  tier: "BASIC" | "BUSINESS" | "PREMIUM";
  name: string;
  priceMonthly: number; // EUR / month
  tagline: string;
  highlighted?: boolean;
  /** Human-readable limits shown on pricing cards. */
  limits: { branches: string; staff: string; customers: string };
  /** Numeric quotas enforced by the app — mirrored onto `Plan`. */
  quota: { maxBranches: number; maxStaff: number; maxCustomers: number };
  /** Vietnamese bullet points for marketing pages. */
  features: string[];
  /** Machine-readable feature keys stored on `Plan.features`. */
  featureKeys: string[];
}

const BASIC_KEYS = ["points", "vouchers", "qr", "reports_basic"];
const BUSINESS_KEYS = [
  "points",
  "vouchers",
  "qr",
  "reports_advanced",
  "campaigns",
  "tiers",
  "rewards",
];
const PREMIUM_KEYS = [
  ...BUSINESS_KEYS,
  "white_label",
  "custom_domain",
  "priority_support",
];

export const PLANS: PlanDisplay[] = [
  {
    tier: "BASIC",
    name: "Basic",
    priceMonthly: 29,
    tagline: "Cho quán nhỏ mới bắt đầu",
    limits: { branches: "1 chi nhánh", staff: "3 nhân viên", customers: "500 khách" },
    quota: { maxBranches: 1, maxStaff: 3, maxCustomers: 500 },
    features: [
      "Tích điểm cơ bản",
      "Thẻ thành viên QR",
      "Voucher cơ bản",
      "Báo cáo cơ bản",
      "Quét QR không giới hạn",
    ],
    featureKeys: BASIC_KEYS,
  },
  {
    tier: "BUSINESS",
    name: "Business",
    priceMonthly: 49,
    tagline: "Cho doanh nghiệp đang phát triển",
    highlighted: true,
    limits: { branches: "3 chi nhánh", staff: "15 nhân viên", customers: "5.000 khách" },
    quota: { maxBranches: 3, maxStaff: 15, maxCustomers: 5000 },
    features: [
      "Tất cả gói Basic",
      "Membership tier (hạng thành viên)",
      "Chiến dịch marketing",
      "Báo cáo nâng cao",
      "Rewards catalog",
      "Chống gian lận nâng cao",
    ],
    featureKeys: BUSINESS_KEYS,
  },
  {
    tier: "PREMIUM",
    name: "Premium",
    priceMonthly: 79,
    tagline: "Cho chuỗi & thương hiệu",
    limits: {
      branches: "Không giới hạn",
      staff: "Không giới hạn",
      customers: "Không giới hạn",
    },
    quota: { maxBranches: 999, maxStaff: 999, maxCustomers: 1000000 },
    features: [
      "Tất cả gói Business",
      "White-label & tên miền riêng",
      "Branding tùy chỉnh",
      "Priority support",
      "API & export nâng cao",
    ],
    featureKeys: PREMIUM_KEYS,
  },
];

/** Price in cents, as stored on `Plan.priceMonthly`. */
export function planPriceCents(tier: PlanDisplay["tier"]): number {
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return Math.round(plan.priceMonthly * 100);
}
