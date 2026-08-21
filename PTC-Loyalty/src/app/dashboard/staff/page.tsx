import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { staffDisplayName, staffNameSelect, workerWhere } from "@/lib/staff-name";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { AddStaffDialog } from "./add-staff-dialog";
import { StaffWorktimeCell } from "./staff-worktime-cell";
import { RemoveStaffDialog } from "./remove-staff-dialog";
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
import { formatNumber } from "@/lib/format";
import type { UserRole } from "@prisma/client";

export const metadata: Metadata = { title: "Nhân viên" };
export const dynamic = "force-dynamic";

const roleLabels: Partial<Record<UserRole, string>> = {
  BUSINESS_MANAGER: "Quản lý",
  STAFF: "Nhân viên",
};

export default async function StaffPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const [staff, branches, departments, business] = await Promise.all([
    db.staffProfile.findMany({
      // CHỦ QUÁN KHÔNG PHẢI NHÂN VIÊN. Chủ vẫn có một dòng StaffProfile vì
      // `requireBusinessContext` dò quán qua bảng này, nhưng chủ không chấm
      // công, không xếp ca, không nằm trong bảng lương — nên không hiện ở đây.
      where: { businessId: ctx.businessId, ...workerWhere },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      include: {
        ...staffNameSelect,
        branch: { select: { name: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { transactions: true, timeEntries: true } },
      },
    }),
    db.branch.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true },
    }),
    db.department.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân viên"
        description="Thêm người là cấp thẻ chấm công luôn, gửi thẳng về WhatsApp của họ."
        action={
          canManage ? (
            <AddStaffDialog
              branches={branches}
              departments={departments}
              businessName={business?.name ?? "Quán"}
              canAddManager={hasAtLeast(ctx.role, "BUSINESS_OWNER")}
            />
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {staff.length === 0 ? (
            <EmptyState
              title="Chưa có nhân viên"
              description="Thêm người đầu tiên — hệ thống sẽ cấp thẻ chấm công và gửi qua WhatsApp ngay."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Bộ phận</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead className="text-right">Lần chấm công</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  {canManage && <TableHead className="text-right">Thẻ &amp; hồ sơ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id} className={s.isActive ? undefined : "opacity-60"}>
                    <TableCell>
                      <span className="font-medium">{staffDisplayName(s)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {/* Nhân viên không có tài khoản nên không có email — số
                            điện thoại mới là cách liên lạc với họ. */}
                        {s.phone ?? s.user?.email ?? "Chưa có số điện thoại"}
                        {s.employeeNo ? ` · ${s.employeeNo}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.role === "BUSINESS_MANAGER" ? "default" : "secondary"}>
                        {roleLabels[s.role] ?? s.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.department?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.branch?.name ?? "Tất cả"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(s._count.timeEntries)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "success" : "destructive"}>
                        {s.isActive ? "Đang làm" : "Đã nghỉ"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <StaffWorktimeCell
                            canSetWage={hasAtLeast(ctx.role, "BUSINESS_OWNER")}
                            departments={departments}
                            profile={{
                              staffId: s.id,
                              name: staffDisplayName(s),
                              departmentId: s.department?.id ?? null,
                              employeeNo: s.employeeNo,
                              phone: s.phone,
                              weeklyHours: s.weeklyHours,
                              hourlyWageCents: s.hourlyWageCents,
                            }}
                          />
                          {s.isActive && (
                            <RemoveStaffDialog
                              staffId={s.id}
                              name={staffDisplayName(s)}
                              timeEntryCount={s._count.timeEntries}
                            />
                          )}
                        </div>
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
