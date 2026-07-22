"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/features", label: "Tính năng" },
  { href: "/pricing", label: "Bảng giá" },
  { href: "/business/pho-hanoi", label: "Demo doanh nghiệp" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/">
          <Brand />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Đăng nhập</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Đăng ký</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
