import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { CreateRewardDialog } from "./create-reward-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Quà tặng" };

export default async function RewardsPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");
  const rewards = await db.reward.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { pointsCost: "asc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Danh mục quà tặng"
        description="Khách hàng dùng điểm để đổi các phần quà này."
        action={canManage ? <CreateRewardDialog /> : undefined}
      />

      {rewards.length === 0 ? (
        <EmptyState title="Chưa có quà tặng" description="Thêm phần quà đầu tiên để khách đổi điểm." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
                {r.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-bold text-primary">
                    {formatNumber(r.pointsCost)} điểm
                  </span>
                  <span className="text-muted-foreground">
                    {r.stock != null ? `Còn ${r.stock}` : "Không giới hạn"} · Đã đổi{" "}
                    {r._count.redemptions}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
