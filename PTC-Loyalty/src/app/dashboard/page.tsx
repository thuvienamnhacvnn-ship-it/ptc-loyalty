import Link from "next/link";
import {
  Users,
  UserPlus,
  Sparkles,
  Gift,
  Receipt,
  Ticket,
  Repeat,
  AlertTriangle,
  ScanLine,
  BarChart3,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart, type ChartPoint } from "@/components/dashboard/activity-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatNumber, formatCurrency } from "@/lib/format";

export default async function DashboardOverview() {
  const ctx = await requireBusinessContext();
  const businessId = ctx.businessId;
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const since30 = new Date(now.getTime() - 30 * day);
  const since14 = new Date(now.getTime() - 14 * day);

  const [
    totalCustomers,
    newCustomers,
    earnAgg,
    redeemAgg,
    txnCount,
    vouchersUsed,
    returningCount,
    recentTxns,
    topCustomers,
    openAlerts,
    chartRows,
  ] = await Promise.all([
    db.customerProfile.count({ where: { businessId } }),
    db.customerProfile.count({ where: { businessId, joinedAt: { gte: since30 } } }),
    db.transaction.aggregate({
      where: { businessId, points: { gt: 0 } },
      _sum: { points: true },
    }),
    db.transaction.aggregate({
      where: { businessId, points: { lt: 0 } },
      _sum: { points: true },
    }),
    db.transaction.count({ where: { businessId } }),
    db.customerVoucher.count({ where: { businessId, status: "REDEEMED" } }),
    db.customerProfile.count({ where: { businessId, visitCount: { gt: 1 } } }),
    db.transaction.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        customer: { select: { firstName: true, lastName: true, memberCode: true } },
      },
    }),
    db.customerProfile.findMany({
      where: { businessId },
      orderBy: { totalEarned: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, totalEarned: true, pointsBalance: true },
    }),
    db.fraudAlert.count({ where: { businessId, resolvedAt: null } }),
    db.transaction.findMany({
      where: { businessId, createdAt: { gte: since14 } },
      select: { points: true, createdAt: true },
    }),
  ]);

  const totalEarned = earnAgg._sum.points ?? 0;
  const totalRedeemed = Math.abs(redeemAgg._sum.points ?? 0);
  const returnRate =
    totalCustomers > 0 ? Math.round((returningCount / totalCustomers) * 100) : 0;

  // Build 14-day chart buckets.
  const buckets = new Map<string, ChartPoint>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * day);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      earned: 0,
      redeemed: 0,
    });
  }
  for (const row of chartRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.points > 0) bucket.earned += row.points;
    else bucket.redeemed += Math.abs(row.points);
  }
  const chartData = Array.from(buckets.values());

  const canReports = hasAtLeast(ctx.role, "BUSINESS_MANAGER");
  const secondaryActions = [
    { href: "/dashboard/customers", icon: Users, label: "Khách hàng", desc: "Danh sách & thêm mới" },
    { href: "/dashboard/transactions", icon: Receipt, label: "Giao dịch", desc: "Lịch sử điểm" },
    canReports
      ? { href: "/dashboard/reports", icon: BarChart3, label: "Báo cáo", desc: "Doanh thu & khách" }
      : { href: "/dashboard/rewards", icon: Gift, label: "Quà tặng", desc: "Đổi thưởng" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick actions — big, thumb-friendly, no menu digging */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/scanner" className="sm:col-span-2 lg:col-span-1">
          <div className="flex h-full min-h-[92px] items-center gap-4 rounded-2xl bg-gradient-to-br from-primary to-accent p-5 text-white shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 active:scale-[0.99]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <ScanLine className="h-6 w-6" />
            </span>
            <div>
              <div className="text-lg font-bold leading-tight">Quét mã QR</div>
              <div className="text-sm text-white/85">Cộng điểm cho khách ngay</div>
            </div>
          </div>
        </Link>
        {secondaryActions.map((a) => (
          <Link key={a.href} href={a.href}>
            <div className="flex h-full min-h-[92px] items-center gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <a.icon className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold leading-tight">{a.label}</div>
                <div className="text-sm text-muted-foreground">{a.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {openAlerts > 0 && (
        <Link href="/dashboard/transactions">
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span>
              Có <strong>{openAlerts}</strong> cảnh báo giao dịch bất thường chưa
              xử lý.
            </span>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng khách hàng" value={formatNumber(totalCustomers)} icon={Users} hint={`+${newCustomers} trong 30 ngày`} />
        <StatCard label="Khách quay lại" value={`${returnRate}%`} icon={Repeat} accent="success" />
        <StatCard label="Điểm đã cấp" value={formatNumber(totalEarned)} icon={Sparkles} accent="accent" />
        <StatCard label="Điểm đã dùng" value={formatNumber(totalRedeemed)} icon={Gift} accent="warning" />
        <StatCard label="Tổng giao dịch" value={formatNumber(txnCount)} icon={Receipt} />
        <StatCard label="Voucher đã dùng" value={formatNumber(vouchersUsed)} icon={Ticket} accent="accent" />
        <StatCard label="Khách mới (30d)" value={formatNumber(newCustomers)} icon={UserPlus} accent="success" />
        <StatCard label="Cảnh báo mở" value={formatNumber(openAlerts)} icon={AlertTriangle} accent={openAlerts > 0 ? "warning" : "primary"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityChart data={chartData} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Khách hàng tích cực</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCustomers.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            )}
            {topCustomers.map((c, i) => (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">
                    {c.firstName} {c.lastName ?? ""}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatNumber(c.pointsBalance)} P
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Giao dịch gần đây</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/transactions">Xem tất cả</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentTxns.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Chưa có giao dịch nào. Hãy quét QR khách hàng đầu tiên.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Hóa đơn</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead className="text-right">Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTxns.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.customer.firstName} {t.customer.lastName ?? ""}
                      <span className="block text-xs text-muted-foreground">
                        {t.customer.memberCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.points >= 0 ? "success" : "warning"}>
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.amount != null ? formatCurrency(t.amount) : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${t.points >= 0 ? "text-success" : "text-accent"}`}
                    >
                      {t.points >= 0 ? "+" : ""}
                      {formatNumber(t.points)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
