"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Ticket, Gift, History, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  card: CreditCard,
  ticket: Ticket,
  gift: Gift,
  history: History,
  user: UserRound,
} as const;

export function MemberNav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof icons }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t bg-background/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active =
            item.href === "/member"
              ? pathname === "/member"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
