"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "./nav-config";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";
import { ROLE_RANK } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/40 md:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 items-center border-b px-5">
          <Link href="/dashboard">
            <Brand />
          </Link>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          {dashboardNav.map((group) => {
            const items = group.items.filter(
              (i) => !i.minRole || ROLE_RANK[role] >= ROLE_RANK[i.minRole],
            );
            if (items.length === 0) return null;
            return (
              <div key={group.group}>
                <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.group}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
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
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
