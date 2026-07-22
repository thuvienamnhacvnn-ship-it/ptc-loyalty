import { db } from "@/lib/db";
import type { PlanTier, Prisma } from "@prisma/client";

// Default membership tiers created for every new business.
export const DEFAULT_TIERS = [
  { name: "Bronze", level: 1, minPoints: 0, pointsMultiplier: 1.0, color: "#a16207" },
  { name: "Silver", level: 2, minPoints: 500, pointsMultiplier: 1.1, color: "#64748b" },
  { name: "Gold", level: 3, minPoints: 2000, pointsMultiplier: 1.25, color: "#ca8a04" },
  { name: "Platinum", level: 4, minPoints: 5000, pointsMultiplier: 1.5, color: "#0ea5e9" },
];

/** Ensure the three subscription plans exist. Idempotent. */
export async function ensurePlans() {
  const plans: {
    tier: PlanTier;
    name: string;
    priceMonthly: number;
    maxBranches: number;
    maxStaff: number;
    maxCustomers: number;
    features: string[];
  }[] = [
    { tier: "BASIC", name: "Basic", priceMonthly: 1900, maxBranches: 1, maxStaff: 3, maxCustomers: 500, features: ["points", "vouchers", "qr", "reports_basic"] },
    { tier: "BUSINESS", name: "Business", priceMonthly: 4900, maxBranches: 3, maxStaff: 15, maxCustomers: 5000, features: ["points", "vouchers", "qr", "reports_advanced", "campaigns", "tiers", "rewards"] },
    { tier: "PREMIUM", name: "Premium", priceMonthly: 9900, maxBranches: 999, maxStaff: 999, maxCustomers: 1000000, features: ["points", "vouchers", "qr", "reports_advanced", "campaigns", "tiers", "rewards", "white_label", "custom_domain", "priority_support"] },
  ];
  for (const p of plans) {
    await db.plan.upsert({
      where: { tier: p.tier },
      update: { name: p.name, priceMonthly: p.priceMonthly, maxBranches: p.maxBranches, maxStaff: p.maxStaff, maxCustomers: p.maxCustomers, features: p.features },
      create: p,
    });
  }
}

interface ProvisionInput {
  ownerId: string;
  name: string;
  type: string;
  slug: string;
  email: string;
  phone?: string;
  city?: string;
  locale?: string;
  planTier?: PlanTier;
  amountPerPoint?: number;
  pointsPerUnit?: number;
  branchName?: string;
  tx?: Prisma.TransactionClient;
}

/**
 * Create a fully-formed tenant: business + branding + settings + default tiers
 * + first branch + owner StaffProfile + trialing subscription.
 * Returns the created business id.
 */
export async function provisionBusiness(input: ProvisionInput): Promise<string> {
  const client = input.tx ?? db;
  const plan = await client.plan.findUnique({
    where: { tier: input.planTier ?? "BASIC" },
  });
  if (!plan) throw new Error("Plans not seeded. Run ensurePlans() first.");

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  const business = await client.business.create({
    data: {
      slug: input.slug,
      name: input.name,
      type: input.type,
      email: input.email,
      phone: input.phone,
      city: input.city,
      country: "DE",
      locale: input.locale ?? "vi",
      ownerId: input.ownerId,
      onboardedAt: new Date(),
      branding: {
        create: { primaryColor: "#2563eb", accentColor: "#f97316" },
      },
      setting: {
        create: {
          amountPerPoint: input.amountPerPoint ?? 1,
          pointsPerUnit: input.pointsPerUnit ?? 1,
          signupBonus: 50,
          birthdayBonus: 100,
          referralBonus: 100,
        },
      },
      subscription: {
        create: {
          planId: plan.id,
          status: "TRIALING",
          trialEndsAt: trialEnds,
        },
      },
      tiers: { create: DEFAULT_TIERS },
      branches: {
        create: { name: input.branchName ?? "Chi nhánh chính", city: input.city },
      },
    },
    include: { branches: true },
  });

  await client.staffProfile.create({
    data: {
      businessId: business.id,
      userId: input.ownerId,
      branchId: business.branches[0]?.id,
      role: "BUSINESS_OWNER",
    },
  });

  return business.id;
}
