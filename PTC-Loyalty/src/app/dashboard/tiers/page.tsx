import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Hạng thành viên" };

export default async function TiersPage() {
  const ctx = await requireBusinessContext();
  const tiers = await db.membershipTier.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { level: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hạng thành viên"
        description="Khách được xếp hạng tự động theo tổng điểm tích lũy trọn đời."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-5">
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${t.color}22`, color: t.color }}
              >
                <Trophy className="h-5 w-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.name}</h3>
                <Badge variant="secondary">×{t.pointsMultiplier}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Từ {formatNumber(t.minPoints)} điểm tích lũy
              </p>
              {t.perks && <p className="mt-2 text-sm">{t.perks}</p>}
              <div className="mt-4 border-t pt-3 text-sm">
                <span className="font-semibold">{formatNumber(t._count.memberships)}</span>{" "}
                <span className="text-muted-foreground">thành viên</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
