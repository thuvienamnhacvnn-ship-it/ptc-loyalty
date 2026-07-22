import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gift } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/page-header";
import { formatNumber } from "@/lib/format";

export default async function BusinessRewardsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await db.business.findUnique({
    where: { slug },
    include: { rewards: { where: { status: "ACTIVE" }, orderBy: { pointsCost: "asc" } } },
  });
  if (!business || business.status === "SUSPENDED") notFound();

  return (
    <div className="container max-w-3xl py-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link href={`/business/${slug}`}>
          <ArrowLeft className="h-4 w-4" /> {business.name}
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">Danh mục quà tặng</h1>
      <p className="mb-6 text-muted-foreground">Đổi điểm lấy những phần quà này.</p>

      {business.rewards.length === 0 ? (
        <EmptyState title="Chưa có quà tặng" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {business.rewards.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Gift className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{r.name}</p>
                  {r.description && (
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  )}
                  <p className="text-sm font-medium text-primary">
                    {formatNumber(r.pointsCost)} điểm
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Button asChild>
          <Link href={`/business/${slug}/join`}>Tham gia để đổi quà</Link>
        </Button>
      </div>
    </div>
  );
}
