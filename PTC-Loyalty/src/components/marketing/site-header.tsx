"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/features", label: "Tính năng" },
  { href: "/pricing", label: "Bảng giá" },
  { href: "/business/pho-hanoi", label: "Demo" },
  { href: "/about", label: "Về chúng tôi" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full">
      {/* gradient hairline at very top */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
      <div className="border-b bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <Brand />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-0 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ModeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/login">Đăng nhập</Link>
            </Button>
            <Button size="sm" asChild className="shadow-sm">
              <Link href="/register">
                Bắt đầu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
