import type { Metadata } from "next";
import { AlertTriangle, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDateTime } from "@/lib/format";
import { setContactMessageStatus } from "./actions";

export const metadata: Metadata = { title: "Admin · Liên hệ" };

const statusVariant = {
  NEW: "warning",
  READ: "default",
  ARCHIVED: "secondary",
} as const;

const statusLabel = {
  NEW: "Mới",
  READ: "Đã đọc",
  ARCHIVED: "Lưu trữ",
} as const;

export default async function AdminContactPage() {
  const [messages, newCount] = await Promise.all([
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Liên hệ từ website</h2>
        <p className="text-sm text-muted-foreground">
          Tin gửi từ form ở trang /contact. Mỗi tin cũng được gửi kèm về hòm thư
          quản trị — bấm Trả lời trong email là thư đi thẳng tới người gửi.
          {newCount > 0 && ` Đang có ${newCount} tin chưa đọc.`}
        </p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title="Chưa có tin nhắn nào"
          description="Tin gửi từ form Liên hệ trên trang công khai sẽ hiển thị tại đây."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{m.name}</p>
                    <a
                      href={`mailto:${m.email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {m.email}
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                      {m.ip && ` · ${m.ip}`}
                    </p>
                  </div>
                  <Badge variant={statusVariant[m.status]}>
                    {statusLabel[m.status]}
                  </Badge>
                </div>

                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                  {m.message}
                </p>

                {m.emailError ? (
                  <p className="flex items-center gap-2 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Không gửi được email báo: {m.emailError}
                  </p>
                ) : !m.emailSent ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    Chưa gửi email báo — chưa đặt RESEND_API_KEY nên email đang ở
                    chế độ ghi log.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${m.email}?subject=Re: Liên hệ PTC Bonus`}>
                      Trả lời
                    </a>
                  </Button>
                  {m.status !== "READ" && (
                    <form action={setContactMessageStatus}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="status" value="READ" />
                      <Button size="sm" variant="ghost" type="submit">
                        Đánh dấu đã đọc
                      </Button>
                    </form>
                  )}
                  {m.status !== "ARCHIVED" && (
                    <form action={setContactMessageStatus}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="status" value="ARCHIVED" />
                      <Button size="sm" variant="ghost" type="submit">
                        Lưu trữ
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
