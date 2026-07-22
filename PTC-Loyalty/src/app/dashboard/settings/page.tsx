import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { hasAtLeast } from "@/lib/rbac";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForms } from "./settings-forms";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const ctx = await requireBusinessContext();
  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    include: { branding: true, whatsappConnection: { select: { status: true } } },
  });
  if (!business) return null;

  const waStatus = business.whatsappConnection?.status ?? "DISCONNECTED";

  return (
    <div className="space-y-6">
      <PageHeader title="Cài đặt" description="Hồ sơ và thương hiệu doanh nghiệp." />

      <Link href="/dashboard/settings/whatsapp">
        <Card className="transition-colors hover:bg-secondary/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">WhatsApp Business</span>
                <Badge variant={waStatus === "CONNECTED" ? "success" : "secondary"}>
                  {waStatus === "CONNECTED" ? "Đã kết nối" : "Chưa kết nối"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Tự động gửi thông báo giao dịch cho khách qua WhatsApp Cloud API.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <SettingsForms
        readOnly={!hasAtLeast(ctx.role, "BUSINESS_OWNER")}
        appBaseUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        business={{
          name: business.name,
          slug: business.slug,
          phone: business.phone,
          addressLine: business.addressLine,
          city: business.city,
          locale: business.locale,
        }}
        branding={{
          primaryColor: business.branding?.primaryColor ?? "#2563eb",
          accentColor: business.branding?.accentColor ?? "#f97316",
          logoUrl: business.branding?.logoUrl ?? null,
        }}
      />
    </div>
  );
}
