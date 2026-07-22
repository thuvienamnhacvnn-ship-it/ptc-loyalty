import { PrismaClient, type PlanTier } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultTemplateRows } from "../src/lib/whatsapp/templates";

const db = new PrismaClient();

// Deterministic pseudo-random so re-seeds produce stable-ish demo data.
let seedState = 1337;
function rand() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const DEMO_PASSWORD = "demo1234";

const firstNames = [
  "An", "Bình", "Chi", "Dũng", "Hà", "Hải", "Hoa", "Hùng", "Khánh", "Lan",
  "Linh", "Mai", "Minh", "Nam", "Nga", "Ngọc", "Phương", "Quân", "Sơn", "Thảo",
  "Thu", "Trang", "Tuấn", "Vân", "Việt", "Yến", "Đức", "Hương", "Long", "Trâm",
];
const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi"];

const tiersA = [
  { name: "Bronze", level: 1, minPoints: 0, pointsMultiplier: 1.0, color: "#a16207" },
  { name: "Silver", level: 2, minPoints: 500, pointsMultiplier: 1.1, color: "#64748b" },
  { name: "Gold", level: 3, minPoints: 2000, pointsMultiplier: 1.25, color: "#ca8a04" },
];

async function ensurePlans() {
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
    await db.plan.upsert({ where: { tier: p.tier }, update: p, create: p });
  }
}

function memberCode(i: number) {
  return `PTC-${(10000 + i).toString(36).toUpperCase()}`;
}

async function main() {
  console.log("🌱 Seeding PTC Loyalty Platform...");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Clean slate (order matters for FKs).
  await db.$transaction([
    db.transactionAdjustment.deleteMany(),
    db.transaction.deleteMany(),
    db.rewardRedemption.deleteMany(),
    db.customerVoucher.deleteMany(),
    db.reward.deleteMany(),
    db.voucher.deleteMany(),
    db.campaignRecipient.deleteMany(),
    db.campaign.deleteMany(),
    db.notification.deleteMany(),
    db.whatsAppMessageLog.deleteMany(),
    db.whatsAppTemplate.deleteMany(),
    db.whatsAppConnection.deleteMany(),
    db.customerCommunicationConsent.deleteMany(),
    db.fraudAlert.deleteMany(),
    db.auditLog.deleteMany(),
    db.loyaltyRule.deleteMany(),
    db.loyaltyProgram.deleteMany(),
    db.customerMembership.deleteMany(),
    db.membershipTier.deleteMany(),
    db.customerProfile.deleteMany(),
    db.staffProfile.deleteMany(),
    db.invitation.deleteMany(),
    db.branch.deleteMany(),
    db.subscription.deleteMany(),
    db.businessSetting.deleteMany(),
    db.businessBranding.deleteMany(),
    db.supportTicket.deleteMany(),
  ]);
  await db.business.deleteMany();
  await db.user.deleteMany();

  await ensurePlans();
  const basicPlan = await db.plan.findUniqueOrThrow({ where: { tier: "BASIC" } });
  const businessPlan = await db.plan.findUniqueOrThrow({ where: { tier: "BUSINESS" } });

  // ── Super Admin ──
  await db.user.create({
    data: {
      name: "PTC Super Admin",
      email: "admin@ptc.de",
      passwordHash: hash,
      role: "SUPER_ADMIN",
      emailVerified: new Date(),
    },
  });

  // ══════════════════ Business A: Phở Hà Nội Berlin ══════════════════
  const ownerA = await db.user.create({
    data: { name: "Nguyễn Văn Chủ", email: "owner@pho-hanoi.de", passwordHash: hash, role: "BUSINESS_OWNER", emailVerified: new Date() },
  });
  const managerA = await db.user.create({
    data: { name: "Trần Thị Quản Lý", email: "manager@pho-hanoi.de", passwordHash: hash, role: "BUSINESS_MANAGER", emailVerified: new Date() },
  });
  const staffAUsers = await Promise.all(
    ["staff@pho-hanoi.de", "staff2@pho-hanoi.de", "staff3@pho-hanoi.de"].map((email, i) =>
      db.user.create({
        data: { name: `Nhân viên ${i + 1}`, email, passwordHash: hash, role: "STAFF", emailVerified: new Date() },
      }),
    ),
  );

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 30);

  const businessA = await db.business.create({
    data: {
      slug: "pho-hanoi",
      name: "Phở Hà Nội Berlin",
      type: "restaurant",
      email: "info@pho-hanoi.de",
      phone: "+49 30 111111",
      city: "Berlin",
      addressLine: "Kantstraße 12",
      country: "DE",
      locale: "vi",
      ownerId: ownerA.id,
      onboardedAt: new Date(),
      branding: { create: { primaryColor: "#b91c1c", accentColor: "#f59e0b" } },
      setting: { create: { amountPerPoint: 1, pointsPerUnit: 1, signupBonus: 50, birthdayBonus: 100, referralBonus: 100, largeTxnThreshold: 300 } },
      subscription: { create: { planId: businessPlan.id, status: "ACTIVE", currentPeriodEnd: trialEnds } },
      tiers: { create: tiersA },
    },
  });

  const branchesA = await Promise.all([
    db.branch.create({ data: { businessId: businessA.id, name: "Phở Hà Nội – Mitte", city: "Berlin", addressLine: "Kantstraße 12", phone: "+49 30 111111", openingHours: "Mo-So 11:00-22:00" } }),
    db.branch.create({ data: { businessId: businessA.id, name: "Phở Hà Nội – Lichtenberg", city: "Berlin", addressLine: "Frankfurter Allee 90", phone: "+49 30 222222", openingHours: "Mo-So 11:00-21:00" } }),
  ]);

  // Staff profiles
  await db.staffProfile.create({ data: { businessId: businessA.id, userId: ownerA.id, role: "BUSINESS_OWNER", branchId: branchesA[0].id } });
  await db.staffProfile.create({ data: { businessId: businessA.id, userId: managerA.id, role: "BUSINESS_MANAGER", branchId: branchesA[0].id } });
  const staffProfilesA = await Promise.all(
    staffAUsers.map((u, i) =>
      db.staffProfile.create({ data: { businessId: businessA.id, userId: u.id, role: "STAFF", branchId: branchesA[i % 2].id, maxPointsGrant: 500 } }),
    ),
  );

  const tierRowsA = await db.membershipTier.findMany({ where: { businessId: businessA.id }, orderBy: { level: "asc" } });

  // Loyalty program
  await db.loyaltyProgram.create({
    data: {
      businessId: businessA.id,
      name: "Tích điểm theo hóa đơn",
      type: "SPEND_BASED",
      config: { amountPerPoint: 1 },
      rules: {
        create: [
          { name: "Thưởng đăng ký", kind: "signup", value: 50 },
          { name: "Thưởng sinh nhật", kind: "birthday", value: 100 },
        ],
      },
    },
  });

  // Vouchers
  await db.voucher.createMany({
    data: [
      { businessId: businessA.id, code: "PHO10", title: "Giảm 10% hóa đơn", description: "Áp dụng toàn menu", discountType: "percent", discountValue: 10, pointsCost: 200, status: "ACTIVE" },
      { businessId: businessA.id, code: "FREESPRING", title: "Tặng 1 phần nem rán", discountType: "free_item", discountValue: 0, pointsCost: 150, status: "ACTIVE" },
    ],
  });

  // Rewards
  await db.reward.createMany({
    data: [
      { businessId: businessA.id, name: "Nem rán miễn phí", description: "1 phần nem rán (6 chiếc)", pointsCost: 150, stock: 100, status: "ACTIVE" },
      { businessId: businessA.id, name: "Phở bò miễn phí", description: "1 tô phở bò tái", pointsCost: 400, stock: 50, status: "ACTIVE" },
      { businessId: businessA.id, name: "Trà đá / nước ngọt", description: "1 đồ uống", pointsCost: 60, status: "ACTIVE" },
      { businessId: businessA.id, name: "Voucher 5€", description: "Giảm trực tiếp 5€", pointsCost: 500, stock: 30, status: "ACTIVE" },
    ],
  });

  // Demo customer with login
  const demoCustomerUser = await db.user.create({
    data: { name: "Khách Demo", email: "khach@demo.de", passwordHash: hash, role: "CUSTOMER", emailVerified: new Date() },
  });

  // Customers (30)
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 30; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const joinedDaysAgo = randInt(1, 180);
    const isDemo = i === 0;
    const customer = await db.customerProfile.create({
      data: {
        businessId: businessA.id,
        userId: isDemo ? demoCustomerUser.id : undefined,
        memberCode: memberCode(i),
        firstName: isDemo ? "Khách" : fn,
        lastName: isDemo ? "Demo" : ln,
        email: isDemo ? "khach@demo.de" : `${fn.toLowerCase()}.${i}@example.de`,
        phone: `+4915${randInt(10000000, 99999999)}`,
        marketingConsent: rand() > 0.4,
        joinedAt: new Date(now - joinedDaysAgo * day),
        locale: "vi",
      },
    });

    // Generate 1–8 EARN transactions per customer
    const txnCount = randInt(1, 8);
    let balance = 0;
    let earned = 0;
    let lastVisit: Date | null = null;
    for (let t = 0; t < txnCount; t++) {
      const amount = randInt(8, 60);
      const points = amount; // 1€ = 1 point
      const before = balance;
      balance += points;
      earned += points;
      const createdAt = new Date(now - randInt(0, joinedDaysAgo) * day - randInt(0, 20) * 60 * 60 * 1000);
      if (!lastVisit || createdAt.getTime() > lastVisit.getTime()) lastVisit = createdAt;
      const staff = pick(staffProfilesA);
      await db.transaction.create({
        data: {
          businessId: businessA.id,
          branchId: staff.branchId,
          customerId: customer.id,
          staffId: staff.id,
          type: "EARN",
          status: "COMPLETED",
          amount,
          points,
          balanceBefore: before,
          balanceAfter: balance,
          createdAt,
          device: "scanner",
        },
      });
    }

    // Occasionally a redemption
    if (balance > 200 && rand() > 0.6) {
      const cost = 150;
      const before = balance;
      balance -= cost;
      await db.transaction.create({
        data: {
          businessId: businessA.id,
          customerId: customer.id,
          staffId: pick(staffProfilesA).id,
          type: "REDEEM",
          status: "COMPLETED",
          points: -cost,
          balanceBefore: before,
          balanceAfter: balance,
          note: "Đổi nem rán miễn phí",
          createdAt: new Date(now - randInt(0, 10) * day),
        },
      });
    }

    // Assign tier from lifetime earned
    const tier = [...tierRowsA].reverse().find((tr) => earned >= tr.minPoints) ?? tierRowsA[0];
    await db.customerMembership.create({ data: { businessId: businessA.id, customerId: customer.id, tierId: tier.id } });
    await db.customerProfile.update({
      where: { id: customer.id },
      data: { pointsBalance: balance, totalEarned: earned, totalRedeemed: earned - balance, visitCount: txnCount, lastVisitAt: lastVisit },
    });
  }

  // A couple of fraud alerts + audit logs for demo
  await db.fraudAlert.createMany({
    data: [
      { businessId: businessA.id, level: "MEDIUM", kind: "rapid_txn", description: "Nhiều giao dịch liên tiếp cùng khách" },
      { businessId: businessA.id, level: "HIGH", kind: "large_txn", description: "Giao dịch điểm lớn vượt ngưỡng" },
    ],
  });
  await db.auditLog.create({
    data: { businessId: businessA.id, userId: ownerA.id, action: "business.seed", entity: "Business", entityId: businessA.id, metadata: { note: "Demo seed" } },
  });

  // ── WhatsApp Business (demo, not connected — no real Meta token) ──
  await db.whatsAppConnection.create({
    data: {
      businessId: businessA.id,
      status: "DISCONNECTED", // connect with a real token in Settings → WhatsApp
      phoneNumberId: "100000000000000",
      wabaId: "200000000000000",
      displayPhoneNumber: "+49 30 111111",
      defaultLanguage: "vi",
      notifyOnEarn: true,
      notifyOnRedeem: true,
      notifyOnVoucher: true,
    },
  });
  await db.whatsAppTemplate.createMany({
    data: defaultTemplateRows().map((r) => ({
      businessId: businessA.id,
      key: r.key,
      language: r.language,
      metaTemplateName: r.metaTemplateName,
      category: r.category,
      bodyPreview: r.bodyPreview,
    })),
  });

  // Consent for the first ~12 customers + sample message history.
  const waCustomers = await db.customerProfile.findMany({
    where: { businessId: businessA.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  });
  const waStatuses = ["SENT", "DELIVERED", "READ", "FAILED", "QUEUED"] as const;
  let waIdx = 0;
  for (const c of waCustomers) {
    const optIn = rand() > 0.25;
    await db.customerCommunicationConsent.create({
      data: {
        businessId: businessA.id,
        customerId: c.id,
        whatsappPhone: c.phone,
        whatsappTransactional: optIn,
        whatsappMarketing: rand() > 0.6,
        transactionalConsentAt: optIn ? new Date() : null,
      },
    });
    if (optIn && c.phone) {
      const status = waStatuses[waIdx % waStatuses.length];
      const now2 = Date.now();
      await db.whatsAppMessageLog.create({
        data: {
          businessId: businessA.id,
          customerId: c.id,
          kind: "POINTS_EARNED",
          status,
          toPhone: c.phone,
          language: "vi",
          templateKey: "points_earned",
          idempotencyKey: `seed:wa:${waIdx}`,
          providerMessageId: status === "QUEUED" ? null : `wamid.SEED${waIdx}`,
          attempts: status === "FAILED" ? 3 : 1,
          error: status === "FAILED" ? "recipient_not_in_allowed_list" : null,
          sentAt: status === "QUEUED" ? null : new Date(now2 - waIdx * 3600 * 1000),
          deliveredAt: ["DELIVERED", "READ"].includes(status) ? new Date(now2 - waIdx * 3500 * 1000) : null,
          readAt: status === "READ" ? new Date(now2 - waIdx * 3400 * 1000) : null,
          failedAt: status === "FAILED" ? new Date(now2 - waIdx * 3600 * 1000) : null,
          payloadSnapshot: { preview: "Demo message" },
        },
      });
      waIdx++;
    }
  }

  // ══════════════════ Business B: Beauty Nails Berlin ══════════════════
  const ownerB = await db.user.create({
    data: { name: "Lê Thị Beauty", email: "owner@nail-berlin.de", passwordHash: hash, role: "BUSINESS_OWNER", emailVerified: new Date() },
  });
  const staffB = await db.user.create({
    data: { name: "NV Nail", email: "staff@nail-berlin.de", passwordHash: hash, role: "STAFF", emailVerified: new Date() },
  });

  const businessB = await db.business.create({
    data: {
      slug: "nail-berlin",
      name: "Beauty Nails Berlin",
      type: "nail_salon",
      email: "hello@nail-berlin.de",
      phone: "+49 30 333333",
      city: "Berlin",
      addressLine: "Sonnenallee 45",
      country: "DE",
      locale: "vi",
      ownerId: ownerB.id,
      onboardedAt: new Date(),
      branding: { create: { primaryColor: "#db2777", accentColor: "#a855f7" } },
      setting: { create: { amountPerPoint: 10, pointsPerUnit: 1, signupBonus: 20, birthdayBonus: 50 } },
      subscription: { create: { planId: basicPlan.id, status: "TRIALING", trialEndsAt: trialEnds } },
      tiers: {
        create: [
          { name: "Bronze", level: 1, minPoints: 0, pointsMultiplier: 1.0, color: "#a16207" },
          { name: "Silver", level: 2, minPoints: 100, pointsMultiplier: 1.1, color: "#64748b" },
          { name: "Gold", level: 3, minPoints: 300, pointsMultiplier: 1.25, color: "#ca8a04" },
        ],
      },
    },
  });

  const branchB = await db.branch.create({
    data: { businessId: businessB.id, name: "Beauty Nails – Neukölln", city: "Berlin", addressLine: "Sonnenallee 45", openingHours: "Mo-Sa 10:00-20:00" },
  });
  await db.staffProfile.create({ data: { businessId: businessB.id, userId: ownerB.id, role: "BUSINESS_OWNER", branchId: branchB.id } });
  const staffProfileB = await db.staffProfile.create({ data: { businessId: businessB.id, userId: staffB.id, role: "STAFF", branchId: branchB.id } });

  await db.loyaltyProgram.create({
    data: {
      businessId: businessB.id,
      name: "10 lần tặng 1 dịch vụ",
      type: "DIGITAL_STAMP",
      config: { stampsRequired: 10, reward: "1 dịch vụ miễn phí" },
    },
  });
  await db.voucher.create({
    data: { businessId: businessB.id, code: "BDAY", title: "Voucher sinh nhật -20%", discountType: "percent", discountValue: 20, pointsCost: 0, status: "ACTIVE", autoBirthday: true },
  });
  await db.reward.create({
    data: { businessId: businessB.id, name: "1 dịch vụ sơn gel miễn phí", pointsCost: 100, status: "ACTIVE" },
  });

  const tierRowsB = await db.membershipTier.findMany({ where: { businessId: businessB.id }, orderBy: { level: "asc" } });
  for (let i = 0; i < 12; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const earned = randInt(0, 400);
    const customer = await db.customerProfile.create({
      data: {
        businessId: businessB.id,
        memberCode: `BN-${(1000 + i).toString(36).toUpperCase()}`,
        firstName: fn,
        lastName: ln,
        phone: `+4917${randInt(1000000, 9999999)}`,
        marketingConsent: rand() > 0.5,
        pointsBalance: earned,
        totalEarned: earned,
        visitCount: randInt(1, 10),
        joinedAt: new Date(now - randInt(1, 120) * day),
        lastVisitAt: new Date(now - randInt(0, 30) * day),
      },
    });
    if (earned > 0) {
      await db.transaction.create({
        data: {
          businessId: businessB.id,
          branchId: branchB.id,
          customerId: customer.id,
          staffId: staffProfileB.id,
          type: "EARN",
          status: "COMPLETED",
          amount: earned * 10,
          points: earned,
          balanceBefore: 0,
          balanceAfter: earned,
        },
      });
    }
    const tier = [...tierRowsB].reverse().find((tr) => earned >= tr.minPoints) ?? tierRowsB[0];
    await db.customerMembership.create({ data: { businessId: businessB.id, customerId: customer.id, tierId: tier.id } });
  }

  // Feature flags + a support ticket
  await db.featureFlag.createMany({
    data: [
      { key: "campaigns_email", description: "Bật gửi email chiến dịch qua Resend", enabled: false },
      { key: "stripe_billing", description: "Bật thanh toán Stripe", enabled: false },
      { key: "white_label", description: "Cho phép white-label ở gói Premium", enabled: true },
    ],
  });
  await db.supportTicket.create({
    data: { businessId: businessA.id, subject: "Yêu cầu thêm phương thức thanh toán", body: "Khách muốn tích điểm khi thanh toán bằng thẻ.", status: "OPEN" },
  });

  const totals = await Promise.all([
    db.business.count(),
    db.user.count(),
    db.customerProfile.count(),
    db.transaction.count(),
  ]);
  console.log(`✅ Done. Businesses=${totals[0]} Users=${totals[1]} Customers=${totals[2]} Transactions=${totals[3]}`);
  console.log(`
Demo logins (password: ${DEMO_PASSWORD}):
  Super Admin  : admin@ptc.de
  Owner (Phở)  : owner@pho-hanoi.de
  Manager      : manager@pho-hanoi.de
  Staff        : staff@pho-hanoi.de
  Customer     : khach@demo.de
  Owner (Nail) : owner@nail-berlin.de
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
