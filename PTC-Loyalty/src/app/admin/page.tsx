import Link from "next/link";
import type { Metadata } from "next";
import {
  Building2,
  Users,
  Receipt,
  ScanLine,
  TrendingUp,
  Euro,
  AlertTriangle,
  Percent,
} from "lucide-react";
import { db } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Tổng quan" };

export default async function AdminOverview() {
  const [
    totalBusinesses,
    activeBusinesses,
    totalCustomers,
    totalTxns,
    scanCount,
    activeSubs,
    trialingSubs,
    openAlerts,
    recentBusinesses,
    subsForMrr,
  ] = await Promise.all([
    db.business.count(),
    db.business.count({ where: { status: "ACTIVE" } }),
    db.customerProfile.count(),
    db.transaction.count(),
    db.transaction.count({ where: { type: "EARN" } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({ where: { status: "TRIALING" } }),
    db.fraudAlert.count({ where: { resolvedAt: null } }),
    db.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { subscription: { include: { plan: true } }, _count: { select: { customers: true } } },
    }),
    db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: true },
    }),
  ]);

  const mrr = subsForMrr.reduce((sum, s) => sum + s.plan.priceMonthly, 0) / 100;
  const arr = mrr * 12;
  const conversion =
    activeSubs + trialingSubs > 0
      ? Math.round((activeSubs / (activeSubs + trialingSubs)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tổng quan nền tảng</h2>
        <p className="text-sm text-muted-foreground">
          Toàn cảnh PTC Loyalty Platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Doanh nghiệp" value={formatNumber(totalBusinesses)} icon={Building2} hint={`${activeBusinesses} đang hoạt động`} />
        <StatCard label="Tổng khách hàng" value={formatNumber(totalCustomers)} icon={Users} accent="success" />
        <StatCard label="Tổng giao dịch" value={formatNumber(totalTxns)} icon={Receipt} />
        <StatCard label="Lượt quét QR" value={formatNumber(scanCount)} icon={ScanLine} accent="accent" />
        <StatCard label="MRR" value={formatCurrency(mrr)} icon={Euro} accent="success" />
        <StatCard label="ARR" value={formatCurrency(arr)} icon={TrendingUp} accent="success" />
        <StatCard label="Trial → Active" value={`${conversion}%`} icon={Percent} accent="accent" />
        <StatCard label="Cảnh báo mở" value={formatNumber(openAlerts)} icon={AlertTriangle} accent={openAlerts > 0 ? "warning" : "primary"} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Doanh nghiệp mới nhất</CardTitle>
          <Link href="/admin/businesses" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentBusinesses.map((b) => (
            <Link
              key={b.id}
              href={`/admin/businesses/${b.id}`}
              className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-secondary"
            >
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  /{b.slug} · {formatDate(b.createdAt)} · {b._count.customers} khách
                </p>
              </div>
              <div className="flex items-center gap-2">
                {b.subscription && <Badge variant="secondary">{b.subscription.plan.name}</Badge>}
                <Badge variant={b.status === "ACTIVE" ? "success" : "destructive"}>
                  {b.status}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
