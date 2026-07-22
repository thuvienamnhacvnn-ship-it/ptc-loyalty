import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";

export default async function MemberHistoryPage() {
  const user = await requireUser();
  const profile = await db.customerProfile.findFirst({ where: { userId: user.id } });
  if (!profile) redirect("/dashboard");

  const transactions = await db.transaction.findMany({
    where: { customerId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Lịch sử điểm</h1>
      {transactions.length === 0 ? (
        <EmptyState title="Chưa có giao dịch" />
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <Badge variant={t.points >= 0 ? "success" : "warning"}>{t.type}</Badge>
                  {t.note && (
                    <p className="mt-1 text-sm text-muted-foreground">{t.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${t.points >= 0 ? "text-success" : "text-accent"}`}>
                    {t.points >= 0 ? "+" : ""}
                    {formatNumber(t.points)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Số dư: {formatNumber(t.balanceAfter)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
