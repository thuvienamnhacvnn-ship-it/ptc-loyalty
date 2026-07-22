import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { MemberNav } from "@/components/member/member-nav";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Business staff/admins shouldn't be here.
  const profile = await db.customerProfile.findFirst({
    where: { userId: user.id },
  });
  if (!profile) {
    // Not a customer of any business.
    if (user.role === "SUPER_ADMIN") redirect("/admin");
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col border-x">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur">
        <Link href="/member">
          <Brand />
        </Link>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Thoát
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      <MemberNav
        items={[
          { href: "/member", label: "Thẻ", icon: "card" },
          { href: "/member/vouchers", label: "Voucher", icon: "ticket" },
          { href: "/member/rewards", label: "Quà", icon: "gift" },
          { href: "/member/history", label: "Lịch sử", icon: "history" },
          { href: "/member/profile", label: "Hồ sơ", icon: "user" },
        ]}
      />
    </div>
  );
}
