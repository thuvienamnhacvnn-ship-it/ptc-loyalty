import Link from "next/link";
import type { Metadata } from "next";
import { Download, Sparkles, Gift, Users, Coins } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart, type ChartPoint } from "@/components/dashboard/activity-chart";
import { SimpleBarChart, type BarDatum } from "@/components/dashboard/bar-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Báo cáo" };

export default async function ReportsPage() {
  const ctx = await requireBusinessContext();
  const businessId = ctx.businessId;
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const [
    earnAgg,
    redeemAgg,
    newCustomers,
    unusedAgg,
    branches,
    chartRows,
    topRewards,
  ] = await Promise.all([
    db.transaction.aggregate({ where: { businessId, points: { gt: 0 } }, _sum: { points: true } }),
    db.transaction.aggregate({ where: { businessId, points: { lt: 0 } }, _sum: { points: true } }),
    db.customerProfile.count({ where: { businessId, joinedAt: { gte: new Date(now.getTime() - 30 * day) } } }),
    db.customerProfile.aggregate({ where: { businessId }, _sum: { pointsBalance: true } }),
    db.branch.findMany({
      where: { businessId },
      select: { name: true, _count: { select: { transactions: true } } },
    }),
    db.transaction.findMany({
      where: { businessId, createdAt: { gte: new Date(now.getTime() - 30 * day) } },
      select: { points: true, createdAt: true },
    }),
    db.rewardRedemption.groupBy({
      by: ["rewardId"],
      where: { businessId },
      _count: { rewardId: true },
      orderBy: { _count: { rewardId: "desc" } },
      take: 5,
    }),
  ]);

  const rewardNames = await db.reward.findMany({
    where: { id: { in: topRewards.map((r) => r.rewardId) } },
    select: { id: true, name: true },
  });
  const rewardNameMap = new Map(rewardNames.map((r) => [r.id, r.name]));

  // 30-day chart
  const buckets = new Map<string, ChartPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { label: `${d.getDate()}.${d.getMonth() + 1}`, earned: 0, redeemed: 0 });
  }
  for (const row of chartRows) {
    const bucket = buckets.get(row.createdAt.toISOString().slice(0, 10));
    if (!bucket) continue;
    if (row.points > 0) bucket.earned += row.points;
    else bucket.redeemed += Math.abs(row.points);
  }
  const chartData = Array.from(buckets.values());

  const branchData: BarDatum[] = branches.map((b) => ({
    label: b.name,
    value: b._count.transactions,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        description="Hiệu quả chương trình khách hàng thân thiết trong 30 ngày."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/reports/export">
              <Download className="h-4 w-4" /> Export giao dịch (CSV)
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Điểm đã cấp" value={formatNumber(earnAgg._sum.points ?? 0)} icon={Sparkles} />
        <StatCard label="Điểm đã dùng" value={formatNumber(Math.abs(redeemAgg._sum.points ?? 0))} icon={Gift} accent="accent" />
        <StatCard label="Khách mới (30d)" value={formatNumber(newCustomers)} icon={Users} accent="success" />
        <StatCard label="Điểm chưa sử dụng" value={formatNumber(unusedAgg._sum.pointsBalance ?? 0)} icon={Coins} accent="warning" />
      </div>

      <ActivityChart data={chartData} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Giao dịch theo chi nhánh</CardTitle>
          </CardHeader>
          <CardContent>
            {branchData.length > 0 ? (
              <SimpleBarChart data={branchData} />
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quà được đổi nhiều nhất</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRewards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có lượt đổi quà.</p>
            ) : (
              topRewards.map((r, i) => (
                <div key={r.rewardId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">
                      {rewardNameMap.get(r.rewardId) ?? "—"}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(r._count.rewardId)} lượt
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
