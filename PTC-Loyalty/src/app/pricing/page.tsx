import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/plans";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Bảng giá" };

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Bảng giá minh bạch</h1>
          <p className="mt-4 text-muted-foreground">
            Dùng thử 14 ngày mọi gói. Không cần thẻ tín dụng. Hủy bất cứ lúc nào.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.tier} className={p.highlighted ? "border-primary shadow-lg ring-1 ring-primary" : ""}>
              <CardContent className="pt-6">
                {p.highlighted && <Badge className="mb-3">Phổ biến nhất</Badge>}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{formatCurrency(p.priceMonthly)}</span>
                  <span className="text-muted-foreground">/tháng</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  <li className="font-medium">{p.limits.branches}</li>
                  <li className="font-medium">{p.limits.staff}</li>
                  <li className="font-medium">{p.limits.customers}</li>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={p.highlighted ? "default" : "outline"} asChild>
                  <Link href="/register">Chọn {p.name}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
