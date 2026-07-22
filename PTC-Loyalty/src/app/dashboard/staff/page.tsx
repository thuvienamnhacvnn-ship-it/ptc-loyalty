import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { AddStaffDialog } from "./add-staff-dialog";
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
import type { UserRole } from "@prisma/client";

export const metadata: Metadata = { title: "Nhân viên" };

const roleLabels: Partial<Record<UserRole, string>> = {
  BUSINESS_OWNER: "Chủ",
  BUSINESS_MANAGER: "Quản lý",
  STAFF: "Nhân viên",
};

export default async function StaffPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const [staff, branches] = await Promise.all([
    db.staffProfile.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true, email: true } },
        branch: { select: { name: true } },
        _count: { select: { transactions: true } },
      },
    }),
    db.branch.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân viên"
        description="Quản lý đội ngũ và phân quyền."
        action={
          canManage ? (
            <AddStaffDialog
              branches={branches}
              canAddManager={hasAtLeast(ctx.role, "BUSINESS_OWNER")}
            />
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {staff.length === 0 ? (
            <EmptyState title="Chưa có nhân viên" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead className="text-right">Giao dịch</TableHead>
                  <TableHead>Đăng nhập cuối</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-medium">{s.user.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.role === "BUSINESS_OWNER" ? "default" : "secondary"}>
                        {roleLabels[s.role] ?? s.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.branch?.name ?? "Tất cả"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(s._count.transactions)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.lastLoginAt ? formatDate(s.lastLoginAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "success" : "destructive"}>
                        {s.isActive ? "Hoạt động" : "Khóa"}
                      </Badge>
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
