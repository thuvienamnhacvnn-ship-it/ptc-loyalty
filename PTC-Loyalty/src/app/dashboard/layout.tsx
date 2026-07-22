import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { MobileNav } from "@/components/dashboard/mobile-nav";

// Dashboard pages are tenant-scoped and query the DB; never prerender at build.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireBusinessContext();
  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar role={ctx.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          businessName={business?.name ?? "PTC Loyalty"}
          userName={ctx.user.name ?? ctx.user.email}
          userEmail={ctx.user.email}
          role={ctx.role}
        />
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
