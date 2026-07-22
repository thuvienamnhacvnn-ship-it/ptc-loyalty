import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
        {/* Email delivery is mocked in the demo (Resend integration ready). */}
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="ban@vidu.de" required />
          </div>
          <Button className="w-full" type="submit">
            Gửi liên kết đặt lại
          </Button>
        </form>
        <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          Bản demo: gửi email được mô phỏng. Kiến trúc đã sẵn sàng tích hợp Resend
          / SendGrid qua <code>RESEND_API_KEY</code>.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
