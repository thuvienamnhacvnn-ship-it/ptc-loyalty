import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { ProfileForm } from "./profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export default async function MemberProfilePage() {
  const user = await requireUser();
  const profile = await db.customerProfile.findFirst({
    where: { userId: user.id },
    include: {
      business: { select: { name: true } },
      communicationConsent: true,
    },
  });
  if (!profile) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Hồ sơ của tôi</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Họ tên" value={`${profile.firstName} ${profile.lastName ?? ""}`} />
          <Row label="Mã thành viên" value={profile.memberCode} />
          <Row label="Email" value={profile.email ?? "—"} />
          <Row label="Doanh nghiệp" value={profile.business.name} />
          <Row label="Tham gia" value={formatDate(profile.joinedAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cập nhật</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            phone={profile.phone ?? ""}
            locale={profile.locale}
            marketingConsent={profile.marketingConsent}
            whatsappPhone={profile.communicationConsent?.whatsappPhone ?? ""}
            whatsappTransactional={
              profile.communicationConsent?.whatsappTransactional ?? false
            }
            whatsappMarketing={
              profile.communicationConsent?.whatsappMarketing ?? false
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
