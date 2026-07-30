import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { businessTypeLabel, BUSINESS_TYPES } from "@/lib/business-types";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/format";
import type { BusinessStatus, Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Admin · Doanh nghiệp" };

const statusVariant = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
  PENDING: "warning",
} as const;

const STATUS_VALUES: BusinessStatus[] = ["ACTIVE", "PENDING", "SUSPENDED"];
const STATUS_LABELS: Record<BusinessStatus, string> = {
  ACTIVE: "Hoạt động",
  PENDING: "Chờ duyệt",
  SUSPENDED: "Đã khóa",
};

function isStatus(value: string): value is BusinessStatus {
  return (STATUS_VALUES as string[]).includes(value);
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const { q, status, type } = await searchParams;
  const query = q?.trim() ?? "";

  const where: Prisma.BusinessWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { city: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status && isStatus(status) ? { status } : {}),
    ...(type ? { type } : {}),
  };

  const [businesses, total] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        owner: { select: { name: true, email: true } },
        subscription: { include: { plan: true } },
        _count: { select: { customers: true, staff: true, transactions: true } },
      },
    }),
    db.business.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Doanh nghiệp</h2>
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} doanh nghiệp khớp bộ lọc.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Tìm theo tên, email, thành phố…"
          />
        </div>
        <select
          name="type"
          defaultValue={type ?? ""}
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả loại hình</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status && isStatus(status) ? status : ""}
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" /> Tìm
        </Button>
        {(query || status || type) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/admin/businesses">Xóa lọc</Link>
          </Button>
        )}
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Chủ sở hữu</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead className="text-right">Khách</TableHead>
                <TableHead className="text-right">NV</TableHead>
                <TableHead className="text-right">Giao dịch</TableHead>
                <TableHead>Tạo</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Không có doanh nghiệp nào khớp bộ lọc.
                  </TableCell>
                </TableRow>
              )}
              {businesses.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/businesses/${b.id}`} className="block">
                      <span className="font-medium">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {businessTypeLabel(b.type)} · {b.city ?? "—"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="block">{b.owner.name ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {b.owner.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    {b.subscription ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="secondary" className="w-fit">
                          {b.subscription.plan.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {SUBSCRIPTION_STATUS_LABELS[b.subscription.status]}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(b._count.customers)}</TableCell>
                  <TableCell className="text-right">{formatNumber(b._count.staff)}</TableCell>
                  <TableCell className="text-right">{formatNumber(b._count.transactions)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(b.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[b.status]}>
                      {STATUS_LABELS[b.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
