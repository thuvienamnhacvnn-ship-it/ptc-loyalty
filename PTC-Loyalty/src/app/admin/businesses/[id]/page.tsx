import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Receipt, Building2, UserCog, KeyRound } from "lucide-react";
import { db } from "@/lib/db";
import { StatusControl } from "./status-control";
import { EditBusinessDialog } from "./edit-business-dialog";
import { SubscriptionControl } from "./subscription-control";
import { PaymentsCard, type PaymentRow } from "./payments-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { businessTypeLabel } from "@/lib/business-types";
import { PLANS } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

const subStatusVariant = {
  TRIALING: "default",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "destructive",
  SUSPENDED: "destructive",
} as const;

export default async function AdminBusinessDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await db.business.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, isActive: true } },
      subscription: { include: { plan: true } },
      setting: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { recordedBy: { select: { name: true, email: true } } },
      },
      _count: {
        select: { customers: true, staff: true, branches: true, transactions: true },
      },
    },
  });
  if (!business) notFound();

  // Server Components cannot hand Date objects to a client component prop that
  // crosses the serialization boundary cleanly, so flatten to ISO strings here.
  const payments: PaymentRow[] = business.payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    status: p.status,
    periodStart: p.periodStart?.toISOString() ?? null,
    periodEnd: p.periodEnd?.toISOString() ?? null,
    reference: p.reference,
    note: p.note,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    recordedBy: p.recordedBy?.name ?? p.recordedBy?.email ?? null,
  }));

  const collected = business.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/businesses">
          <ArrowLeft className="h-4 w-4" /> Danh sách doanh nghiệp
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{business.name}</h2>
            <Badge variant={business.status === "ACTIVE" ? "success" : "destructive"}>
              {business.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            /{business.slug} · {businessTypeLabel(business.type)} ·{" "}
            {business.city ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <EditBusinessDialog
            businessId={business.id}
            business={{
              name: business.name,
              type: business.type,
              email: business.email,
              phone: business.phone,
              addressLine: business.addressLine,
              city: business.city,
              locale: business.locale,
            }}
          />
          <SubscriptionControl
            businessId={business.id}
            subscription={
              business.subscription
                ? {
                    planTier: business.subscription.plan.tier,
                    status: business.subscription.status,
                    trialEndsAt: business.subscription.trialEndsAt,
                    currentPeriodEnd: business.subscription.currentPeriodEnd,
                  }
                : null
            }
          />
          <StatusControl businessId={business.id} status={business.status} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/business/${business.slug}`} target="_blank">
              Xem trang công khai
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Khách hàng" value={formatNumber(business._count.customers)} icon={Users} />
        <StatCard label="Nhân viên" value={formatNumber(business._count.staff)} icon={UserCog} accent="accent" />
        <StatCard label="Chi nhánh" value={formatNumber(business._count.branches)} icon={Building2} />
        <StatCard
          label="Đã thu"
          value={formatCurrency(collected / 100)}
          icon={Receipt}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Chủ sở hữu" value={business.owner.name ?? "—"} />
            <Row label="Email chủ" value={business.owner.email} />
            <Row label="Email DN" value={business.email} />
            <Row label="Điện thoại" value={business.phone ?? "—"} />
            <Row label="Địa chỉ" value={business.addressLine ?? "—"} />
            <Row label="Thành phố" value={business.city ?? "—"} />
            <Row label="Ngôn ngữ" value={business.locale} />
            <Row label="Ngày tạo" value={formatDate(business.createdAt)} />
            <div className="pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/users?q=${encodeURIComponent(business.owner.email)}`}>
                  <KeyRound className="h-4 w-4" /> Quản lý tài khoản chủ
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thuê bao & quy tắc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {business.subscription ? (
              <>
                <Row label="Gói" value={business.subscription.plan.name} />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trạng thái</span>
                  <Badge variant={subStatusVariant[business.subscription.status]}>
                    {SUBSCRIPTION_STATUS_LABELS[business.subscription.status]}
                  </Badge>
                </div>
                <Row
                  label="Giá hiện tại"
                  value={`${formatCurrency(business.subscription.plan.priceMonthly / 100)}/tháng`}
                />
                <Row
                  label="Hết hạn thử"
                  value={
                    business.subscription.trialEndsAt
                      ? formatDate(business.subscription.trialEndsAt)
                      : "—"
                  }
                />
                <Row
                  label="Đã trả đến"
                  value={
                    business.subscription.currentPeriodEnd
                      ? formatDate(business.subscription.currentPeriodEnd)
                      : "—"
                  }
                />
              </>
            ) : (
              <p className="text-muted-foreground">
                Chưa có thuê bao. Dùng &quot;Đổi gói / trạng thái&quot; để tạo.
              </p>
            )}
            {business.setting && (
              <Row
                label="Quy tắc điểm"
                value={`${business.setting.amountPerPoint}€ = ${business.setting.pointsPerUnit} điểm`}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentsCard
        businessId={business.id}
        suggestedAmount={
          business.subscription
            ? business.subscription.plan.priceMonthly / 100
            : PLANS[0].priceMonthly
        }
        payments={payments}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
