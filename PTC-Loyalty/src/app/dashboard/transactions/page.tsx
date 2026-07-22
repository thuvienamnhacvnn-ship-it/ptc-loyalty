import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { ReverseButton } from "./reverse-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Giao dịch" };

const riskVariant = {
  LOW: "secondary",
  MEDIUM: "warning",
  HIGH: "destructive",
  CRITICAL: "destructive",
} as const;

export default async function TransactionsPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const [transactions, alerts] = await Promise.all([
    db.transaction.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true, memberCode: true } },
        staff: { include: { user: { select: { name: true } } } },
      },
    }),
    db.fraudAlert.findMany({
      where: { businessId: ctx.businessId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Giao dịch" description="Toàn bộ lịch sử tích và tiêu điểm" />

      {alerts.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Cảnh báo gian lận ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>{a.description}</span>
                <Badge variant={riskVariant[a.level]}>{a.level}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <EmptyState title="Chưa có giao dịch" description="Giao dịch sẽ xuất hiện tại đây sau khi quét QR." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Hóa đơn</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead className="text-right">Thời gian</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-medium">
                        {t.customer.firstName} {t.customer.lastName ?? ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.customer.memberCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "REVERSED" ? "secondary" : t.points >= 0 ? "success" : "warning"}>
                        {t.status === "REVERSED" ? "REVERSED" : t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.staff?.user.name ?? "—"}
                    </TableCell>
                    <TableCell>{t.amount != null ? formatCurrency(t.amount) : "—"}</TableCell>
                    <TableCell className={`text-right font-semibold ${t.points >= 0 ? "text-success" : "text-accent"}`}>
                      {t.points >= 0 ? "+" : ""}
                      {formatNumber(t.points)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {t.status === "COMPLETED" && <ReverseButton transactionId={t.id} />}
                      </TableCell>
                    )}
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
