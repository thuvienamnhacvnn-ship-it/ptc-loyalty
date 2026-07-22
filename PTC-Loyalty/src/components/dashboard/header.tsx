"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, User as UserIcon } from "lucide-react";
import { dashboardNav } from "./nav-config";
import { logout } from "@/app/(auth)/actions";
import { ModeToggle } from "@/components/mode-toggle";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_RANK } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

interface HeaderProps {
  businessName: string;
  userName: string;
  userEmail: string;
  role: UserRole;
}

function usePageTitle(): string {
  const pathname = usePathname();
  let best = "Bảng điều khiển";
  let bestLen = 0;
  for (const group of dashboardNav) {
    for (const item of group.items) {
      if (
        (pathname === item.href || pathname.startsWith(item.href + "/")) &&
        item.href.length > bestLen
      ) {
        best = item.label;
        bestLen = item.href.length;
      }
    }
  }
  return best;
}

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  BUSINESS_OWNER: "Chủ doanh nghiệp",
  BUSINESS_MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  CUSTOMER: "Khách hàng",
};

export function DashboardHeader({
  businessName,
  userName,
  userEmail,
  role,
}: HeaderProps) {
  const title = usePageTitle();
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile nav */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="left-0 top-0 h-full max-w-xs translate-x-0 translate-y-0 rounded-none">
            <DialogTitle className="sr-only">Menu</DialogTitle>
            <Brand className="mb-4" />
            <nav className="space-y-4 overflow-y-auto">
              {dashboardNav.map((g) => (
                <div key={g.group}>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    {g.group}
                  </p>
                  {g.items
                    .filter((i) => !i.minRole || ROLE_RANK[role] >= ROLE_RANK[i.minRole])
                    .map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-secondary"
                      >
                        <i.icon className="h-4 w-4" />
                        {i.label}
                      </Link>
                    ))}
                </div>
              ))}
            </nav>
          </DialogContent>
        </Dialog>

        <div>
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
          <p className="text-xs text-muted-foreground">{businessName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials || <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:block">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{userName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {userEmail}
              </div>
              <div className="mt-1 text-xs font-normal text-primary">
                {roleLabels[role]}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Cài đặt</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logout}>
              <button type="submit" className="w-full">
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
