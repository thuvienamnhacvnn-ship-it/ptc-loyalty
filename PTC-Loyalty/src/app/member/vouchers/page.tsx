import { redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { RedeemButton } from "@/components/member/redeem-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDate, formatNumber } from "@/lib/format";

export default async function MemberVouchersPage() {
  const user = await requireUser();
  const profile = await db.customerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) redirect("/dashboard");

  const [myVouchers, available] = await Promise.all([
    db.customerVoucher.findMany({
      where: { customerId: profile.id },
      orderBy: { issuedAt: "desc" },
      include: { voucher: true },
    }),
    db.voucher.findMany({
      where: {
        businessId: profile.businessId,
        status: "ACTIVE",
        pointsCost: { gt: 0 },
      },
      orderBy: { pointsCost: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Voucher của tôi</h1>
        {myVouchers.length === 0 ? (
          <EmptyState title="Chưa có voucher" description="Đổi điểm lấy voucher bên dưới." />
        ) : (
          <div className="mt-3 space-y-3">
            {myVouchers.map((cv) => (
              <Card key={cv.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{cv.voucher.title}</p>
                    <p className="font-mono text-sm text-muted-foreground">{cv.code}</p>
                    {cv.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        HSD: {formatDate(cv.expiresAt)}
                      </p>
                    )}
                  </div>
                  <Badge variant={cv.status === "ISSUED" ? "success" : "secondary"}>
                    {cv.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Đổi điểm lấy voucher</h2>
          <div className="space-y-3">
            {available.map((v) => {
              const affordable = profile.pointsBalance >= v.pointsCost;
              return (
                <Card key={v.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{v.title}</p>
                      <p className="text-sm font-medium text-primary">
                        {formatNumber(v.pointsCost)} điểm
                      </p>
                    </div>
                    <div className="w-24 shrink-0">
                      <RedeemButton
                        id={v.id}
                        kind="voucher"
                        disabled={!affordable}
                        label={affordable ? "Đổi" : "Thiếu điểm"}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
