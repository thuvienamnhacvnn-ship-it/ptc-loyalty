import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Đăng ký doanh nghiệp" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Đăng ký doanh nghiệp</CardTitle>
        <CardDescription>
          Tạo chương trình khách hàng thân thiết trong vài phút
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
