import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatDate, formatNumber } from "@/lib/format";

export default async function BusinessOffersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await db.business.findUnique({
    where: { slug },
    include: {
      vouchers: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!business || business.status === "SUSPENDED") notFound();

  return (
    <div className="container max-w-3xl py-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href={`/business/${slug}`}>
          <ArrowLeft className="h-4 w-4" /> {business.name}
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">Ưu đãi hiện có</h1>
      <p className="mb-6 text-muted-foreground">Voucher và ưu đãi đang áp dụng.</p>

      {business.vouchers.length === 0 ? (
        <EmptyState title="Chưa có ưu đãi" />
      ) : (
        <div className="space-y-3">
          {business.vouchers.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Ticket className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{v.title}</p>
                  {v.description && (
                    <p className="text-sm text-muted-foreground">{v.description}</p>
                  )}
                  {v.expiresAt && (
                    <p className="text-xs text-muted-foreground">HSD: {formatDate(v.expiresAt)}</p>
                  )}
                </div>
                {v.pointsCost > 0 && (
                  <Badge variant="secondary">{formatNumber(v.pointsCost)} điểm</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
