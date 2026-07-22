import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { StatusControl } from "./status-control";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Receipt, Building2, UserCog } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";

export default async function AdminBusinessDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await db.business.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true } },
      subscription: { include: { plan: true } },
      setting: true,
      _count: {
        select: { customers: true, staff: true, branches: true, transactions: true },
      },
    },
  });
  if (!business) notFound();

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
            /{business.slug} · {business.type} · {business.city ?? "—"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
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
        <StatCard label="Giao dịch" value={formatNumber(business._count.transactions)} icon={Receipt} accent="success" />
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
            <Row label="Ngôn ngữ" value={business.locale} />
            <Row label="Ngày tạo" value={formatDate(business.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thuê bao & quy tắc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {business.subscription && (
              <>
                <Row label="Gói" value={business.subscription.plan.name} />
                <Row label="Trạng thái" value={business.subscription.status} />
                {business.subscription.trialEndsAt && (
                  <Row label="Hết hạn thử" value={formatDate(business.subscription.trialEndsAt)} />
                )}
              </>
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
