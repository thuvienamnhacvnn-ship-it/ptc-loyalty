import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { QuickJoinForm } from "./quick-join-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The page behind the QR code printed on the restaurant's table/counter:
 *   https://ptc-bonus.com/j/<slug>
 *
 * Short path on purpose — it keeps the printed QR sparse and easy to scan on a
 * cheap phone camera in bad light.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await db.business.findUnique({
    where: { slug },
    select: { name: true },
  });
  return {
    title: business ? `Đăng ký thành viên · ${business.name}` : "Đăng ký thành viên",
    robots: { index: false, follow: false },
  };
}

export default async function QuickJoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await db.business.findUnique({
    where: { slug },
    include: { branding: true, setting: true },
  });
  if (!business || business.status === "SUSPENDED") notFound();

  const bonus = business.setting?.signupBonus ?? 0;
  const primary = business.branding?.primaryColor ?? "#2563eb";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            {business.branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.branding.logoUrl}
                alt={business.name}
                className="mx-auto mb-2 h-16 w-auto object-contain"
              />
            ) : (
              <div
                className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ backgroundColor: primary }}
              >
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
            <CardTitle className="text-2xl">{business.name}</CardTitle>
            <CardDescription className="text-base">
              Đăng ký thành viên trong 10 giây.
              {bonus > 0 ? ` Nhận ngay ${bonus} điểm!` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickJoinForm slug={slug} storeName={business.name} />
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Bằng việc đăng ký, bạn đồng ý với{" "}
          <a href="/privacy" className="underline">
            chính sách bảo mật
          </a>
          .
        </p>
      </div>
    </div>
  );
}
