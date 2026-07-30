import Link from "next/link";
import type { Metadata } from "next";
import { Euro, Wallet, Clock, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANT,
  getRevenueSummary,
} from "@/lib/billing";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { PaymentStatus, Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Admin · Thanh toán" };

const STATUS_VALUES: PaymentStatus[] = ["PAID", "PENDING", "FAILED", "REFUNDED"];

function isStatus(value: string): value is PaymentStatus {
  return (STATUS_VALUES as string[]).includes(value);
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const where: Prisma.PaymentWhereInput =
    status && isStatus(status) ? { status } : {};

  const [summary, payments, total] = await Promise.all([
    getRevenueSummary(),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        business: { select: { id: true, name: true } },
        plan: { select: { name: true } },
        recordedBy: { select: { name: true, email: true } },
      },
    }),
    db.payment.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Thanh toán</h2>
        <p className="text-sm text-muted-foreground">
          Toàn bộ khoản thu thuê bao trên nền tảng.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Đã thu (tất cả)"
          value={formatCurrency(summary.collectedTotal / 100)}
          icon={Wallet}
          accent="success"
          hint={`${formatNumber(summary.paymentCount)} khoản`}
        />
        <StatCard
          label="Thu tháng này"
          value={formatCurrency(summary.collectedThisMonth / 100)}
          icon={Euro}
          accent="success"
        />
        <StatCard
          label="Chờ thu"
          value={formatCurrency(summary.outstanding / 100)}
          icon={Clock}
          accent={summary.outstanding > 0 ? "warning" : "primary"}
        />
        <StatCard
          label="MRR"
          value={formatCurrency(summary.mrr / 100)}
          icon={TrendingUp}
          accent="accent"
          hint="Từ thuê bao đang hoạt động"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={!status ? "default" : "outline"} size="sm" asChild>
          <Link href="/admin/payments">Tất cả</Link>
        </Button>
        {STATUS_VALUES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/admin/payments?status=${s}`}>
              {PAYMENT_STATUS_LABELS[s]}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Hình thức</TableHead>
                <TableHead>Kỳ</TableHead>
                <TableHead>Tham chiếu</TableHead>
                <TableHead>Ghi nhận bởi</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Chưa có khoản thanh toán nào. Ghi nhận từ trang chi tiết doanh
                    nghiệp.
                  </TableCell>
                </TableRow>
              )}
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/admin/businesses/${p.businessId}`}
                      className="font-medium hover:underline"
                    >
                      {p.business.name}
                    </Link>
                    {p.plan && (
                      <span className="block text-xs text-muted-foreground">
                        {p.plan.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.amount / 100, p.currency)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PAYMENT_METHOD_LABELS[p.method]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.periodStart && p.periodEnd
                      ? `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.reference ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.recordedBy?.name ?? p.recordedBy?.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_STATUS_VARIANT[p.status]}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {total > payments.length && (
        <p className="text-xs text-muted-foreground">
          Hiển thị {formatNumber(payments.length)} / {formatNumber(total)} khoản mới
          nhất.
        </p>
      )}
    </div>
  );
}
