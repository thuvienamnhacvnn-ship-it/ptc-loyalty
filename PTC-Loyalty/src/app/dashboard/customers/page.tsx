import Link from "next/link";
import type { Metadata } from "next";
import { Download, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { AddCustomerDialog } from "./add-customer-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export const metadata: Metadata = { title: "Khách hàng" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireBusinessContext();
  const { q } = await searchParams;

  const where: Prisma.CustomerProfileWhereInput = { businessId: ctx.businessId };
  if (q && q.trim().length > 0) {
    const term = q.trim();
    where.OR = [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
      { memberCode: { contains: term, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    db.customerProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { membership: { include: { tier: true } } },
    }),
    db.customerProfile.count({ where: { businessId: ctx.businessId } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách hàng"
        description={`${formatNumber(total)} thành viên`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/customers/export">
                <Download className="h-4 w-4" /> Export CSV
              </Link>
            </Button>
            <AddCustomerDialog />
          </div>
        }
      />

      <form method="get" className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Tìm theo tên, SĐT, email, mã TV..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Tìm
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <EmptyState
              title={q ? "Không tìm thấy khách hàng" : "Chưa có khách hàng"}
              description={
                q
                  ? "Thử từ khóa khác."
                  : "Thêm khách hàng đầu tiên hoặc để họ tự đăng ký qua trang tham gia."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Hạng</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead className="text-right">Lần cuối</TableHead>
                  <TableHead>Tham gia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/dashboard/customers/${c.id}`} className="block">
                        <span className="font-medium">
                          {c.firstName} {c.lastName ?? ""}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {c.memberCode}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.phone ?? c.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      {c.membership?.tier ? (
                        <Badge style={{ color: c.membership.tier.color }}>
                          {c.membership.tier.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(c.pointsBalance)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {c.lastVisitAt ? formatDate(c.lastVisitAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.joinedAt)}
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
