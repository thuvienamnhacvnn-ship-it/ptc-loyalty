import Link from "next/link";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Quên mật khẩu</CardTitle>
        <CardDescription>
          Nhập email, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
