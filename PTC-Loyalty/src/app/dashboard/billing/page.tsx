import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Thanh toán" };

const statusVariant = {
  TRIALING: "default",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "destructive",
  SUSPENDED: "destructive",
} as const;

export default async function BillingPage() {
  const ctx = await requireBusinessContext();
  const [sub, counts] = await Promise.all([
    db.subscription.findUnique({
      where: { businessId: ctx.businessId },
      include: { plan: true },
    }),
    Promise.all([
      db.branch.count({ where: { businessId: ctx.businessId } }),
      db.staffProfile.count({ where: { businessId: ctx.businessId } }),
      db.customerProfile.count({ where: { businessId: ctx.businessId } }),
    ]),
  ]);
  const [branchCount, staffCount, customerCount] = counts;

  const usage = sub
    ? [
        { label: "Chi nhánh", used: branchCount, max: sub.plan.maxBranches },
        { label: "Nhân viên", used: staffCount, max: sub.plan.maxStaff },
        { label: "Khách hàng", used: customerCount, max: sub.plan.maxCustomers },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Gói dịch vụ & Thanh toán" description="Quản lý thuê bao của bạn." />

      {sub && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Gói hiện tại: {sub.plan.name}</CardTitle>
            <Badge variant={statusVariant[sub.status]}>{sub.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatCurrency(sub.plan.priceMonthly / 100)}
              </span>
              <span className="text-muted-foreground">/tháng</span>
            </div>
            {sub.status === "TRIALING" && sub.trialEndsAt && (
              <p className="text-sm text-muted-foreground">
                Dùng thử đến {formatDate(sub.trialEndsAt)}.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {usage.map((u) => {
                const pct = u.max > 0 ? Math.min(100, Math.round((u.used / u.max) * 100)) : 0;
                return (
                  <div key={u.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{u.label}</span>
                      <span className="font-medium">
                        {formatNumber(u.used)} / {u.max >= 999 ? "∞" : formatNumber(u.max)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${pct > 90 ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
              Thanh toán được mô phỏng trong bản demo. Tích hợp Stripe đã sẵn sàng
              qua <code>STRIPE_SECRET_KEY</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-4 text-lg font-semibold">Các gói khác</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.tier} className={sub?.plan.tier === p.tier ? "ring-1 ring-primary" : ""}>
              <CardContent className="pt-6">
                <h4 className="text-lg font-bold">{p.name}</h4>
                <div className="mt-2">
                  <span className="text-2xl font-bold">{formatCurrency(p.priceMonthly)}</span>
                  <span className="text-sm text-muted-foreground">/tháng</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={sub?.plan.tier === p.tier ? "secondary" : "outline"}
                  disabled={sub?.plan.tier === p.tier}
                  asChild={sub?.plan.tier !== p.tier}
                >
                  {sub?.plan.tier === p.tier ? (
                    <span>Đang dùng</span>
                  ) : (
                    <Link href="/contact">Liên hệ nâng cấp</Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
