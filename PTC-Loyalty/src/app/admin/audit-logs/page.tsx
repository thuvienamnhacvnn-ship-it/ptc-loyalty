import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Audit logs" };

export default async function AdminAuditLogsPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      business: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit logs</h2>
        <p className="text-sm text-muted-foreground">
          Nhật ký hành động không thể chỉnh sửa trực tiếp.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState title="Chưa có nhật ký" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Doanh nghiệp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(l.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.action}</TableCell>
                    <TableCell className="text-sm">
                      {l.entity}
                      {l.entityId ? `#${l.entityId.slice(-6)}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.user?.name ?? l.user?.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.business?.name ?? "—"}
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
