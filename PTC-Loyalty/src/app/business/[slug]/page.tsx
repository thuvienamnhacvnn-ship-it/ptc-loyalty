import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Gift, MapPin, Sparkles, Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await db.business.findUnique({ where: { slug } });
  return { title: business ? business.name : "Doanh nghiệp" };
}

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await db.business.findUnique({
    where: { slug },
    include: {
      branding: true,
      setting: true,
      tiers: { orderBy: { level: "asc" } },
      rewards: { where: { status: "ACTIVE" }, orderBy: { pointsCost: "asc" }, take: 4 },
      branches: { where: { isActive: true } },
    },
  });
  if (!business || business.status === "SUSPENDED") notFound();

  const primary = business.branding?.primaryColor ?? "#2563eb";
  const accent = business.branding?.accentColor ?? "#f97316";

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-bold">{business.name}</span>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button size="sm" asChild>
            <Link href={`/business/${slug}/join`}>Tham gia</Link>
          </Button>
        </div>
      </header>

      <section
        className="px-6 py-16 text-center text-white"
        style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
      >
        <h1 className="text-3xl font-bold sm:text-4xl">{business.name}</h1>
        <p className="mt-3 opacity-90">
          Tham gia chương trình khách hàng thân thiết — tích điểm mỗi lần ghé thăm.
        </p>
        {business.setting && (
          <p className="mt-2 text-sm opacity-80">
            {business.setting.amountPerPoint}€ = {business.setting.pointsPerUnit} điểm
            {business.setting.signupBonus > 0 &&
              ` · Tặng ${business.setting.signupBonus} điểm khi đăng ký`}
          </p>
        )}
        <Button size="lg" variant="secondary" className="mt-6" asChild>
          <Link href={`/business/${slug}/join`}>Đăng ký thành viên miễn phí</Link>
        </Button>
      </section>

      <div className="container max-w-4xl space-y-10 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature icon={Sparkles} title="Tích điểm" desc="Mỗi hóa đơn được cộng điểm tự động." />
          <Feature icon={Gift} title="Đổi quà" desc="Dùng điểm đổi quà và ưu đãi hấp dẫn." />
          <Feature icon={Ticket} title="Voucher" desc="Nhận voucher và ưu đãi sinh nhật." />
        </div>

        {business.rewards.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Quà tặng nổi bật</h2>
              <Link href={`/business/${slug}/rewards`} className="text-sm text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {business.rewards.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <Gift className="h-6 w-6" style={{ color: accent }} />
                    <p className="mt-2 font-semibold">{r.name}</p>
                    <p className="text-sm font-medium" style={{ color: primary }}>
                      {formatNumber(r.pointsCost)} điểm
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {business.branches.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold">Chi nhánh</h2>
            <div className="space-y-2">
              {business.branches.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium text-foreground">{b.name}</span>
                  {b.addressLine && <span>· {b.addressLine}</span>}
                  {b.city && <span>· {b.city}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Gift;
  title: string;
  desc: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 text-center">
        <Icon className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
