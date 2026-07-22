import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoyaltyForm } from "./loyalty-form";

export const metadata: Metadata = { title: "Chương trình tích điểm" };

export default async function LoyaltyPage() {
  const ctx = await requireBusinessContext();
  const setting = await db.businessSetting.findUnique({
    where: { businessId: ctx.businessId },
  });
  if (!setting) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chương trình tích điểm"
        description="Thiết lập cách khách hàng tích và nhận điểm thưởng."
      />
      <LoyaltyForm
        readOnly={!hasAtLeast(ctx.role, "BUSINESS_MANAGER")}
        settings={{
          amountPerPoint: setting.amountPerPoint,
          pointsPerUnit: setting.pointsPerUnit,
          rounding: setting.rounding,
          minPointsPerTxn: setting.minPointsPerTxn,
          maxPointsPerTxn: setting.maxPointsPerTxn,
          signupBonus: setting.signupBonus,
          birthdayBonus: setting.birthdayBonus,
          referralBonus: setting.referralBonus,
          pointsExpiryDays: setting.pointsExpiryDays,
        }}
      />
    </div>
  );
}
