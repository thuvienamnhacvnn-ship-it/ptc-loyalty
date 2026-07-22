"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ScanLine, Receipt, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Trang chủ" },
  { href: "/dashboard/customers", icon: Users, label: "Khách" },
  { href: "/dashboard/scanner", icon: ScanLine, label: "Quét", center: true },
  { href: "/dashboard/transactions", icon: Receipt, label: "Giao dịch" },
  { href: "/dashboard/rewards", icon: Gift, label: "Quà" },
];

/** App-style bottom tab bar for phones. Hidden on md+ (sidebar takes over). */
export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {tabs.map((t) =>
          t.center ? (
            <Link
              key={t.href}
              href={t.href}
              className="-mt-5 flex flex-col items-center justify-end px-2"
              aria-label={t.label}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95">
                <t.icon className="h-6 w-6" />
              </span>
              <span className="mt-0.5 text-[11px] font-semibold text-primary">{t.label}</span>
            </Link>
          ) : (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                isActive(t.href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
