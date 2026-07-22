import type { Metadata } from "next";
import { Building2, MapPin, Phone, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { CreateBranchDialog } from "./create-branch-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Chi nhánh" };

export default async function BranchesPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");
  const branches = await db.branch.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { staff: true, transactions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chi nhánh"
        description="Quản lý các địa điểm kinh doanh của bạn."
        action={canManage ? <CreateBranchDialog /> : undefined}
      />

      {branches.length === 0 ? (
        <EmptyState title="Chưa có chi nhánh" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Badge variant={b.isActive ? "success" : "secondary"}>
                    {b.isActive ? "Hoạt động" : "Tạm dừng"}
                  </Badge>
                </div>
                <h3 className="mt-3 font-semibold">{b.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {(b.addressLine || b.city) && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {[b.addressLine, b.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {b.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> {b.phone}
                    </p>
                  )}
                  {b.openingHours && (
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" /> {b.openingHours}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex justify-between border-t pt-3 text-sm">
                  <span>{formatNumber(b._count.staff)} nhân viên</span>
                  <span>{formatNumber(b._count.transactions)} giao dịch</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
