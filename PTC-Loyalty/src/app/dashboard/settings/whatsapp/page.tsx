import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { getConnection, type ConnectionView } from "@/lib/whatsapp/connection";
import { getProvider } from "@/lib/whatsapp/providers";
import { WA_LANGUAGES, defaultTemplateRows } from "@/lib/whatsapp/templates";
import { WhatsAppSettingsForm } from "./whatsapp-settings-form";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "WhatsApp" };

const statusVariant = {
  QUEUED: "secondary",
  SENT: "default",
  DELIVERED: "success",
  READ: "success",
  FAILED: "destructive",
} as const;

const kindLabel: Record<string, string> = {
  WELCOME: "Chào mừng",
  POINTS_EARNED: "Cộng điểm",
  REWARD_REDEEMED: "Đổi quà",
  VOUCHER: "Voucher",
  TEST: "Thử",
  MANUAL: "Thủ công",
  INBOUND: "Khách gửi",
};

const templateKeyLabel: Record<string, string> = {
  welcome: "Chào mừng thành viên mới",
  member_card: "Chú thích ảnh QR thành viên",
  points_earned: "Cộng điểm",
  reward_redeemed: "Đổi quà",
  voucher: "Voucher mới",
};

export default async function WhatsAppSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>;
}) {
  const ctx = await requireBusinessContext();
  const { q, status, from, to } = await searchParams;

  const where: Prisma.WhatsAppMessageLogWhereInput = { businessId: ctx.businessId };
  if (status && status in statusVariant) {
    where.status = status as keyof typeof statusVariant;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { toPhone: { contains: term } },
      { customer: { firstName: { contains: term, mode: "insensitive" } } },
      { customer: { lastName: { contains: term, mode: "insensitive" } } },
      { customer: { memberCode: { contains: term, mode: "insensitive" } } },
    ];
  }

  const [connection, messages] = await Promise.all([
    getConnection(ctx.businessId),
    db.whatsAppMessageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true, memberCode: true } },
      },
    }),
  ]);

  // Stored state for the first paint; the form polls the provider for the live
  // session as soon as it mounts.
  const provider = getProvider(connection?.provider);
  const connectionView: ConnectionView = {
    status: (connection?.status ?? "DISCONNECTED") as ConnectionView["status"],
    providerId: provider.id,
    providerLabel: provider.label,
    qrDataUrl: connection?.status === "QR_PENDING" ? connection.lastQr ?? undefined : undefined,
    phoneNumber: connection?.displayPhoneNumber ?? null,
    profileName: connection?.profileName ?? null,
    connectedAt: connection?.connectedAt ?? null,
    error: connection?.lastError ?? null,
  };

  const templates = defaultTemplateRows();
  const byKey = new Map<string, typeof templates>();
  for (const t of templates) {
    const arr = byKey.get(t.key) ?? [];
    arr.push(t);
    byKey.set(t.key, arr);
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard/settings">
          <ArrowLeft className="h-4 w-4" /> Cài đặt
        </Link>
      </Button>

      <PageHeader
        title="WhatsApp"
        description="Gửi tin nhắn cho khách bằng chính số WhatsApp của nhà hàng — quét mã QR một lần, không cần Meta Business."
      />

      <WhatsAppSettingsForm
        canManageConnection={hasAtLeast(ctx.role, "BUSINESS_OWNER")}
        canManage={hasAtLeast(ctx.role, "BUSINESS_MANAGER")}
        connection={connectionView}
        defaultLanguage={connection?.defaultLanguage ?? "vi"}
        notifyOnSignup={connection?.notifyOnSignup ?? true}
        notifyOnEarn={connection?.notifyOnEarn ?? true}
        notifyOnRedeem={connection?.notifyOnRedeem ?? true}
        notifyOnVoucher={connection?.notifyOnVoucher ?? true}
      />

      {/* Template previews (3 languages) */}
      <Card>
        <CardHeader>
          <CardTitle>Nội dung tin nhắn (VI · DE · EN)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from(byKey.entries()).map(([key, rows]) => (
            <div key={key}>
              <p className="mb-2 text-sm font-semibold">
                {templateKeyLabel[key] ?? key}
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {WA_LANGUAGES.map((lang) => {
                  const row = rows.find((r) => r.language === lang);
                  return (
                    <div key={lang} className="rounded-md border bg-muted/30 p-3">
                      <Badge variant="secondary" className="mb-2 uppercase">
                        {lang}
                      </Badge>
                      <p className="whitespace-pre-line text-xs text-muted-foreground">
                        {row?.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Đây là tin nhắn chat thường gửi từ số của nhà hàng — không cần ai duyệt.
            Các biến {"{{1}}, {{2}}, …"} được thay theo đúng thứ tự ở trên.
          </p>
        </CardContent>
      </Card>

      {/* Message history + filters */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử tin nhắn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="q" className="text-xs">Khách hàng / SĐT</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Tên, mã TV, số..." className="h-9 w-48" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">Trạng thái</Label>
              <select id="status" name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Tất cả</option>
                <option value="QUEUED">Chờ gửi</option>
                <option value="SENT">Đã gửi</option>
                <option value="DELIVERED">Đã nhận</option>
                <option value="READ">Đã đọc</option>
                <option value="FAILED">Thất bại</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">Từ ngày</Label>
              <Input id="from" name="from" type="date" defaultValue={from} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">Đến ngày</Label>
              <Input id="to" name="to" type="date" defaultValue={to} className="h-9" />
            </div>
            <Button type="submit" variant="secondary" size="sm">Lọc</Button>
            {(q || status || from || to) && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/dashboard/settings/whatsapp">Xóa lọc</Link>
              </Button>
            )}
          </form>

          {messages.length === 0 ? (
            <EmptyState
              title="Chưa có tin nhắn"
              description="Tin nhắn WhatsApp sẽ xuất hiện tại đây sau khi gửi."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Khách / SĐT</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Ngôn ngữ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                    <TableCell>
                      {m.customer ? (
                        <span className="font-medium">
                          {m.customer.firstName} {m.customer.lastName ?? ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      <span className="block text-xs text-muted-foreground">{m.toPhone}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{kindLabel[m.kind] ?? m.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-sm uppercase text-muted-foreground">
                      {m.language}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[m.status]}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {m.error ?? (m.attempts > 0 ? `${m.attempts} lần thử` : "—")}
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
