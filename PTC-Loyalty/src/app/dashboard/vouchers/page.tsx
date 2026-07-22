import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { CreateVoucherDialog } from "./create-voucher-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Voucher" };

const statusVariant = {
  DRAFT: "secondary",
  ACTIVE: "success",
  USED: "secondary",
  EXPIRED: "warning",
  CANCELLED: "destructive",
} as const;

const discountLabel = {
  percent: "Giảm %",
  fixed: "Giảm €",
  free_item: "Tặng món",
} as Record<string, string>;

export default async function VouchersPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const vouchers = await db.voucher.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { customerVouchers: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voucher"
        description="Phát hành và quản lý voucher giảm giá."
        action={canManage ? <CreateVoucherDialog /> : undefined}
      />

      <Card>
        <CardContent className="p-0">
          {vouchers.length === 0 ? (
            <EmptyState title="Chưa có voucher" description="Tạo voucher đầu tiên để thu hút khách hàng." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Điểm đổi</TableHead>
                  <TableHead className="text-right">Đã phát</TableHead>
                  <TableHead>Hết hạn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.title}</TableCell>
                    <TableCell className="font-mono text-sm">{v.code}</TableCell>
                    <TableCell className="text-sm">
                      {discountLabel[v.discountType]} · {v.discountValue}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(v.pointsCost)}</TableCell>
                    <TableCell className="text-right">
                      {v._count.customerVouchers}
                      {v.quantity != null ? ` / ${v.quantity}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.expiresAt ? formatDate(v.expiresAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[v.status]}>{v.status}</Badge>
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
