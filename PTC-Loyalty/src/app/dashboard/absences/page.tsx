import type { Metadata } from "next";
import { FileCheck2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { absenceDayCount, utcDateToKey } from "@/lib/schedule";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AbsenceForm } from "./absence-form";
import { decideAbsence, markCertificate } from "./actions";
import { staffDisplayName, staffNameSelect, workerWhere } from "@/lib/staff-name";

export const metadata: Metadata = { title: "Nghỉ phép & báo ốm" };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  SICK: "Báo ốm",
  VACATION: "Nghỉ phép",
  UNPAID: "Không lương",
  TRAINING: "Đào tạo",
  OTHER: "Khác",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  REQUESTED: { label: "Chờ duyệt", variant: "warning" },
  APPROVED: { label: "Đã duyệt", variant: "success" },
  REJECTED: { label: "Từ chối", variant: "destructive" },
  CANCELLED: { label: "Đã huỷ", variant: "secondary" },
};

/** "2026-08-24" → "24.08.2026" */
function viDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

export default async function AbsencesPage() {
  const ctx = await requireBusinessContext();
  const isManager = hasAtLeast(ctx.role, "BUSINESS_MANAGER");

  const [staff, absences] = await Promise.all([
    db.staffProfile.findMany({
      // Chủ quán không báo nghỉ với chính mình.
      where: { businessId: ctx.businessId, isActive: true, ...workerWhere },
      select: { id: true, ...staffNameSelect },
      orderBy: { createdAt: "asc" },
    }),
    db.staffAbsence.findMany({
      where: {
        businessId: ctx.businessId,
        // Nhân viên thường chỉ thấy kỳ nghỉ của chính mình.
        ...(isManager ? {} : { staffId: ctx.staffProfileId }),
      },
      orderBy: [{ startDate: "desc" }],
      take: 100,
      include: { staff: { select: staffNameSelect } },
    }),
  ]);

  const pending = absences.filter((a) => a.status === "REQUESTED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nghỉ phép & báo ốm"
        description={
          isManager
            ? "Ai đang nghỉ thì hệ thống tự chặn không xếp ca vào những ngày đó."
            : "Báo nghỉ cho chính bạn. Quản lý sẽ thấy ngay."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Báo nghỉ</CardTitle>
            <CardDescription>
              Ngày nghỉ tính cả ngày đầu lẫn ngày cuối.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AbsenceForm
              isManager={isManager}
              lockedStaffId={isManager ? undefined : ctx.staffProfileId}
              staff={staff.map((s) => ({ id: s.id, name: staffDisplayName(s) }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          {isManager && pending.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chờ duyệt ({pending.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {staffDisplayName(a.staff)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[a.type]} · {viDate(utcDateToKey(a.startDate))} –{" "}
                        {viDate(utcDateToKey(a.endDate))}
                        {a.note ? ` · ${a.note}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={decideAbsence}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <Button type="submit" size="sm">
                          Duyệt
                        </Button>
                      </form>
                      <form action={decideAbsence}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <Button type="submit" size="sm" variant="outline">
                          Từ chối
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {absences.length === 0 ? (
                <EmptyState
                  title="Chưa có ai báo nghỉ"
                  description="Khi có người báo ốm, ca của họ trong những ngày đó sẽ tự được gỡ khỏi lịch."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Từ – đến</TableHead>
                      <TableHead className="text-right">Số ngày</TableHead>
                      <TableHead>Giấy bác sĩ</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absences.map((a) => {
                      const startKey = utcDateToKey(a.startDate);
                      const endKey = utcDateToKey(a.endDate);
                      const days = absenceDayCount({
                        startDateKey: startKey,
                        endDateKey: endKey,
                      });
                      const status = STATUS_LABELS[a.status] ?? STATUS_LABELS.REQUESTED;
                      const needsCertificate =
                        a.type === "SICK" && days >= 3 && !a.hasCertificate;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {staffDisplayName(a.staff)}
                          </TableCell>
                          <TableCell className="text-sm">{TYPE_LABELS[a.type]}</TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {viDate(startKey)} – {viDate(endKey)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{days}</TableCell>
                          <TableCell>
                            {a.type !== "SICK" ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : a.hasCertificate ? (
                              <Badge variant="success">Đã nộp</Badge>
                            ) : needsCertificate && isManager ? (
                              <form action={markCertificate}>
                                <input type="hidden" name="id" value={a.id} />
                                <Button type="submit" size="sm" variant="outline">
                                  <FileCheck2 className="h-3.5 w-3.5" /> Đánh dấu đã nộp
                                </Button>
                              </form>
                            ) : needsCertificate ? (
                              <Badge variant="warning">Cần giấy</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Chưa cần</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
