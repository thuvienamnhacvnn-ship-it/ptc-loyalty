"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Package,
  ShieldAlert,
  ScrollText,
  Settings,
  LifeBuoy,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Doanh nghiệp", icon: Building2 },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/subscriptions", label: "Thuê bao", icon: CreditCard },
  { href: "/admin/plans", label: "Gói dịch vụ", icon: Package },
  { href: "/admin/fraud", label: "Cảnh báo gian lận", icon: ShieldAlert },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { href: "/admin/support", label: "Hỗ trợ", icon: LifeBuoy },
  { href: "/admin/settings", label: "Cấu hình", icon: Settings },
];

export function AdminShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-card/40 md:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-16 items-center gap-2 border-b px-5">
            <Link href="/admin">
              <Brand />
            </Link>
            <Badge variant="warning">Admin</Badge>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {nav.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            PTC Platform Console
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium sm:block">{userName}</span>
            <ModeToggle />
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                Đăng xuất
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
