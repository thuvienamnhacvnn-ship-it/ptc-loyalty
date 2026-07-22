import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
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

export const metadata: Metadata = { title: "Admin · Doanh nghiệp" };

const statusVariant = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
  PENDING: "warning",
} as const;

export default async function AdminBusinessesPage() {
  const businesses = await db.business.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { customers: true, staff: true, transactions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Doanh nghiệp</h2>
        <p className="text-sm text-muted-foreground">
          {formatNumber(businesses.length)} doanh nghiệp trên nền tảng.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead className="text-right">Khách</TableHead>
                <TableHead className="text-right">NV</TableHead>
                <TableHead className="text-right">Giao dịch</TableHead>
                <TableHead>Tạo</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/businesses/${b.id}`} className="block">
                      <span className="font-medium">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        /{b.slug} · {b.city ?? "—"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {b.subscription ? (
                      <Badge variant="secondary">{b.subscription.plan.name}</Badge>
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
                    <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
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
