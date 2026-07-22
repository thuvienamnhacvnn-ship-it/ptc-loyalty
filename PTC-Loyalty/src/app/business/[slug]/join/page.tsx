import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { JoinForm } from "./join-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await db.business.findUnique({
    where: { slug },
    include: { setting: true },
  });
  if (!business || business.status === "SUSPENDED") notFound();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Tham gia {business.name}</CardTitle>
            <CardDescription>
              Đăng ký miễn phí để tích điểm và nhận ưu đãi.
              {business.setting?.signupBonus
                ? ` Nhận ngay ${business.setting.signupBonus} điểm!`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <JoinForm slug={slug} />
            <p className="text-center text-sm text-muted-foreground">
              Đã là thành viên?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Đăng nhập
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
