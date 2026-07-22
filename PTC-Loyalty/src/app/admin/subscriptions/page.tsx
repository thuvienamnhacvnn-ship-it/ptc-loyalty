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
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Thuê bao" };

const statusVariant = {
  TRIALING: "default",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "destructive",
  SUSPENDED: "destructive",
} as const;

export default async function AdminSubscriptionsPage() {
  const subs = await db.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: { business: true, plan: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Thuê bao</h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead className="text-right">Giá/tháng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hết hạn thử</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/admin/businesses/${s.businessId}`} className="font-medium hover:underline">
                      {s.business.name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.plan.name}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(s.plan.priceMonthly / 100)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.trialEndsAt ? formatDate(s.trialEndsAt) : "—"}
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
