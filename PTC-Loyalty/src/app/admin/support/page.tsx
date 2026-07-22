import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Hỗ trợ" };

const statusVariant = {
  OPEN: "warning",
  IN_PROGRESS: "default",
  RESOLVED: "success",
  CLOSED: "secondary",
} as const;

export default async function AdminSupportPage() {
  const tickets = await db.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Yêu cầu hỗ trợ</h2>
      </div>
      {tickets.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu hỗ trợ"
          description="Yêu cầu từ các doanh nghiệp sẽ hiển thị tại đây."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-sm text-muted-foreground">{t.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
