import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ScanLine,
  Ticket,
  Gift,
  Sparkles,
  Trophy,
  Megaphone,
  BarChart3,
  Building2,
  UserCog,
  Settings,
  CreditCard,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: UserRole; // minimum role required to see the item
}

export const dashboardNav: { group: string; items: NavItem[] }[] = [
  {
    group: "Tổng quan",
    items: [
      { href: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
      { href: "/dashboard/scanner", label: "Quét QR", icon: ScanLine },
      { href: "/dashboard/transactions", label: "Giao dịch", icon: Receipt },
    ],
  },
  {
    group: "Khách hàng",
    items: [
      { href: "/dashboard/customers", label: "Khách hàng", icon: Users },
      { href: "/dashboard/vouchers", label: "Voucher", icon: Ticket },
      { href: "/dashboard/rewards", label: "Quà tặng", icon: Gift },
      { href: "/dashboard/campaigns", label: "Chiến dịch", icon: Megaphone, minRole: "BUSINESS_MANAGER" },
    ],
  },
  {
    group: "Cấu hình",
    items: [
      { href: "/dashboard/loyalty", label: "Chương trình tích điểm", icon: Sparkles, minRole: "BUSINESS_MANAGER" },
      { href: "/dashboard/tiers", label: "Hạng thành viên", icon: Trophy, minRole: "BUSINESS_MANAGER" },
      { href: "/dashboard/branches", label: "Chi nhánh", icon: Building2, minRole: "BUSINESS_MANAGER" },
      { href: "/dashboard/staff", label: "Nhân viên", icon: UserCog, minRole: "BUSINESS_MANAGER" },
      { href: "/dashboard/reports", label: "Báo cáo", icon: BarChart3, minRole: "BUSINESS_MANAGER" },
    ],
  },
  {
    group: "Tài khoản",
    items: [
      { href: "/dashboard/settings", label: "Cài đặt", icon: Settings, minRole: "BUSINESS_OWNER" },
      { href: "/dashboard/billing", label: "Thanh toán", icon: CreditCard, minRole: "BUSINESS_OWNER" },
    ],
  },
];
