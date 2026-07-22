import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Chào mừng trở lại</CardTitle>
        <CardDescription>
          Đăng nhập vào tài khoản PTC Loyalty của bạn
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Đăng ký doanh nghiệp
          </Link>
        </p>
        <div className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Tài khoản demo</p>
          <p>Super Admin: admin@ptc.de / demo1234</p>
          <p>Chủ quán: owner@pho-hanoi.de / demo1234</p>
          <p>Nhân viên: staff@pho-hanoi.de / demo1234</p>
          <p>Khách hàng: khach@demo.de / demo1234</p>
        </div>
      </CardContent>
    </Card>
  );
}
