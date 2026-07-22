import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { CreateCampaignDialog } from "./create-campaign-dialog";
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
import { formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Chiến dịch" };

export default async function CampaignsPage() {
  const ctx = await requireBusinessContext();
  const canManage = hasAtLeast(ctx.role, "BUSINESS_MANAGER");
  const campaigns = await db.campaign.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { recipients: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chiến dịch marketing"
        description="Gửi ưu đãi tới nhóm khách hàng mục tiêu."
        action={canManage ? <CreateCampaignDialog /> : undefined}
      />

      <Card>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <EmptyState
              title="Chưa có chiến dịch"
              description="Tạo chiến dịch để nhắc khách quay lại hoặc chúc mừng sinh nhật."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chiến dịch</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead className="text-right">Người nhận</TableHead>
                  <TableHead className="text-right">Đã mở</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Gửi lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.subject}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(c._count.recipients)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(c.openCount)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "SENT" ? "success" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {c.sentAt ? formatDateTime(c.sentAt) : "—"}
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
