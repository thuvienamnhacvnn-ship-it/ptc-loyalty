import crypto from "node:crypto";
import { db } from "@/lib/db";
import { PLANS, planPriceCents } from "@/lib/plans";
import type { PlanTier, Prisma } from "@prisma/client";

/**
 * A business slug is random and opaque: `biz-` + 12 lowercase hex chars, e.g.
 * `biz-9f3c1a0b7d24`. It is NEVER derived from the business name and never
 * exposes the sequential DB id. Generated + verified unique on the server; the
 * `slug @unique` DB constraint is the final guard.
 */
export function generateBusinessSlug(): string {
  return `biz-${crypto.randomBytes(6).toString("hex")}`;
}

/**
 * Return a slug that is not already used by an existing business. On the
 * (astronomically unlikely, 2^48-space) collision it regenerates rather than
 * surfacing an error to the user.
 */
export async function generateUniqueBusinessSlug(
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateBusinessSlug();
    const existing = await client.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  // Extra entropy fallback — practically never reached.
  return `biz-${crypto.randomBytes(9).toString("hex")}`;
}

// Default membership tiers created for every new business.
export const DEFAULT_TIERS = [
  { name: "Bronze", level: 1, minPoints: 0, pointsMultiplier: 1.0, color: "#a16207" },
  { name: "Silver", level: 2, minPoints: 500, pointsMultiplier: 1.1, color: "#64748b" },
  { name: "Gold", level: 3, minPoints: 2000, pointsMultiplier: 1.25, color: "#ca8a04" },
  { name: "Platinum", level: 4, minPoints: 5000, pointsMultiplier: 1.5, color: "#0ea5e9" },
];

/**
 * Ensure the three subscription plans exist and match the catalog in
 * `src/lib/plans.ts`. Idempotent — safe to call on every request.
 *
 * This is a one-way sync: the code is authoritative, so editing a price in
 * `PLANS` and reloading /admin/plans is all it takes to change what businesses
 * are billed. Existing subscriptions keep pointing at the same `Plan` row and
 * pick the new price up automatically.
 */
export async function ensurePlans() {
  for (const p of PLANS) {
    const row = {
      tier: p.tier as PlanTier,
      name: p.name,
      priceMonthly: planPriceCents(p.tier),
      maxBranches: p.quota.maxBranches,
      maxStaff: p.quota.maxStaff,
      maxCustomers: p.quota.maxCustomers,
      features: p.featureKeys,
    };
    await db.plan.upsert({
      where: { tier: row.tier },
      update: row,
      create: row,
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
