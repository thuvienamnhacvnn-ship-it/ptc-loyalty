import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { MemberCard } from "@/components/member/member-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export default async function MemberHomePage() {
  const user = await requireUser();
  const profile = await db.customerProfile.findFirst({
    where: { userId: user.id },
    include: {
      business: { include: { branding: true } },
      membership: { include: { tier: true } },
    },
  });
  if (!profile) redirect("/dashboard");

  // Progress to next tier.
  const nextTier = await db.membershipTier.findFirst({
    where: {
      businessId: profile.businessId,
      minPoints: { gt: profile.totalEarned },
    },
    orderBy: { minPoints: "asc" },
  });
  const currentMin = profile.membership?.tier.minPoints ?? 0;
  const progress = nextTier
    ? Math.min(
        100,
        Math.round(
          ((profile.totalEarned - currentMin) / (nextTier.minPoints - currentMin)) * 100,
        ),
      )
    : 100;

  return (
    <div className="space-y-4">
      <MemberCard
        businessName={profile.business.name}
        memberName={`${profile.firstName} ${profile.lastName ?? ""}`.trim()}
        memberCode={profile.memberCode}
        points={profile.pointsBalance}
        tierName={profile.membership?.tier.name ?? null}
        tierColor={profile.membership?.tier.color ?? null}
        primaryColor={profile.business.branding?.primaryColor ?? "#2563eb"}
      />

      {nextTier && (
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Còn {formatNumber(nextTier.minPoints - profile.totalEarned)} điểm để lên hạng
              </span>
              <span className="font-medium">{nextTier.name}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
