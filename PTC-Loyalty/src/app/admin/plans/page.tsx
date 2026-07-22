import type { Metadata } from "next";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { ensurePlans } from "@/lib/provision";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Gói dịch vụ" };

export default async function AdminPlansPage() {
  await ensurePlans();
  const [plans, counts] = await Promise.all([
    db.plan.findMany({ orderBy: { priceMonthly: "asc" } }),
    db.subscription.groupBy({ by: ["planId"], _count: { planId: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.planId, c._count.planId]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Gói dịch vụ</h2>
        <p className="text-sm text-muted-foreground">
          Cấu hình gói được đồng bộ tự động khi khởi tạo hệ thống.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <Badge variant="secondary">
                  {formatNumber(countMap.get(p.id) ?? 0)} DN
                </Badge>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">
                  {formatCurrency(p.priceMonthly / 100)}
                </span>
                <span className="text-sm text-muted-foreground">/tháng</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li>{p.maxBranches >= 999 ? "Không giới hạn" : p.maxBranches} chi nhánh</li>
                <li>{p.maxStaff >= 999 ? "Không giới hạn" : p.maxStaff} nhân viên</li>
                <li>{p.maxCustomers >= 999999 ? "Không giới hạn" : formatNumber(p.maxCustomers)} khách</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.features.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
                    <Check className="h-3 w-3 text-success" /> {f}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
