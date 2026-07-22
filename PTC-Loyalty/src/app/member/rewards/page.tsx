import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { RedeemButton } from "@/components/member/redeem-button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatNumber } from "@/lib/format";

export default async function MemberRewardsPage() {
  const user = await requireUser();
  const profile = await db.customerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) redirect("/dashboard");

  const rewards = await db.reward.findMany({
    where: { businessId: profile.businessId, status: "ACTIVE" },
    orderBy: { pointsCost: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Đổi quà</h1>
        <p className="text-sm text-muted-foreground">
          Số dư: <span className="font-semibold text-foreground">{formatNumber(profile.pointsBalance)}</span> điểm
        </p>
      </div>

      {rewards.length === 0 ? (
        <EmptyState title="Chưa có quà" description="Doanh nghiệp chưa thêm phần quà nào." />
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => {
            const affordable = profile.pointsBalance >= r.pointsCost;
            const inStock = r.stock == null || r.stock > 0;
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.name}</p>
                    {r.description && (
                      <p className="truncate text-sm text-muted-foreground">{r.description}</p>
                    )}
                    <p className="text-sm font-medium text-primary">
                      {formatNumber(r.pointsCost)} điểm
                    </p>
                  </div>
                  <div className="w-24 shrink-0">
                    <RedeemButton
                      id={r.id}
                      kind="reward"
                      disabled={!affordable || !inStock}
                      label={!inStock ? "Hết" : affordable ? "Đổi" : "Thiếu điểm"}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
