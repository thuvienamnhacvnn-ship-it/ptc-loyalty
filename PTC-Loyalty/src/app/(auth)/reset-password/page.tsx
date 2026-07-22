import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };

// Token + email arrive as query params from the emailed link.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token = "", email = "" } = await searchParams;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Đặt lại mật khẩu</CardTitle>
        <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResetPasswordForm token={token} email={email} />
      </CardContent>
    </Card>
  );
}
