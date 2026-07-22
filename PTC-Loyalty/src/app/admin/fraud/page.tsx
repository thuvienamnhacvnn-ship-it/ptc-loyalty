import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { ResolveButton } from "./resolve-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Gian lận" };

const riskVariant = {
  LOW: "secondary",
  MEDIUM: "warning",
  HIGH: "destructive",
  CRITICAL: "destructive",
} as const;

export default async function AdminFraudPage() {
  const alerts = await db.fraudAlert.findMany({
    where: { resolvedAt: null },
    orderBy: [{ level: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { business: { select: { name: true, slug: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cảnh báo gian lận</h2>
        <p className="text-sm text-muted-foreground">
          Cảnh báo tự phát hiện trên toàn nền tảng.
        </p>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title="Không có cảnh báo"
          description="Hệ thống chưa phát hiện hành vi bất thường nào."
          action={<ShieldCheck className="h-8 w-8 text-success" />}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={riskVariant[a.level]}>{a.level}</Badge>
                    <span className="font-medium">{a.kind}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.business.name} · {a.description} · {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <ResolveButton alertId={a.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
