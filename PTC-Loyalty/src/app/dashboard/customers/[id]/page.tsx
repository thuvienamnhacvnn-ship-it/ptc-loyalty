import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { CustomerActions } from "./customer-actions";
import { CustomerQrCard } from "../customer-qr-card";
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
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireBusinessContext();
  const { id } = await params;

  const customer = await db.customerProfile.findUnique({
    where: { id },
    include: {
      membership: { include: { tier: true } },
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      customerVouchers: { include: { voucher: true }, orderBy: { issuedAt: "desc" } },
    },
  });

  // Tenant isolation: never render a customer from another business.
  if (!customer || customer.businessId !== ctx.businessId) notFound();

  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");
  const canOwn = hasAtLeast(ctx.role, "BUSINESS_OWNER");

  const details: { label: string; value: string }[] = [
    { label: "Email", value: customer.email ?? "—" },
    { label: "Số điện thoại", value: customer.phone ?? "—" },
    { label: "Ngày sinh", value: customer.birthDate ? formatDate(customer.birthDate) : "—" },
    { label: "Ngôn ngữ", value: customer.locale },
    { label: "Tham gia", value: formatDate(customer.joinedAt) },
    { label: "Lần mua gần nhất", value: customer.lastVisitAt ? formatDate(customer.lastVisitAt) : "—" },
    { label: "Số lần ghé", value: formatNumber(customer.visitCount) },
    { label: "Marketing", value: customer.marketingConsent ? "Đồng ý" : "Từ chối" },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard/customers">
          <ArrowLeft className="h-4 w-4" /> Danh sách khách hàng
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {customer.firstName} {customer.lastName ?? ""}
            </h2>
            {customer.isBlocked && <Badge variant="destructive">Đã khóa</Badge>}
            {customer.isAnonymized && <Badge variant="secondary">Ẩn danh</Badge>}
            {customer.membership?.tier && (
              <Badge style={{ color: customer.membership.tier.color }}>
                {customer.membership.tier.name}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{customer.memberCode}</p>
        </div>
        <CustomerActions
          customerId={customer.id}
          isBlocked={customer.isBlocked}
          canManage={canManage}
          canOwn={canOwn}
          customer={{
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            email: customer.email,
            birthDate: customer.birthDate
              ? customer.birthDate.toISOString().slice(0, 10)
              : null,
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Số dư điểm</p>
            <p className="text-3xl font-bold">{formatNumber(customer.pointsBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Tổng đã nhận</p>
            <p className="text-3xl font-bold text-success">{formatNumber(customer.totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Tổng đã dùng</p>
            <p className="text-3xl font-bold text-accent">{formatNumber(customer.totalRedeemed)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {details.map((d) => (
                <div key={d.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <CustomerQrCard customerId={customer.id} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lịch sử giao dịch</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customer.transactions.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Chưa có giao dịch.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="text-right">Điểm</TableHead>
                    <TableHead className="text-right">Số dư</TableHead>
                    <TableHead className="text-right">Thời gian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Badge variant={t.points >= 0 ? "success" : "warning"}>{t.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {t.note ?? "—"}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${t.points >= 0 ? "text-success" : "text-accent"}`}>
                        {t.points >= 0 ? "+" : ""}
                        {formatNumber(t.points)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(t.balanceAfter)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
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
    </div>
  );
}
