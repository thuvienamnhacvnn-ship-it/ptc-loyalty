import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Yêu cầu dữ liệu (GDPR)" };

export default function DataRequestPage() {
  return (
    <MarketingShell>
      <section className="container max-w-2xl py-16">
        <h1 className="text-4xl font-bold tracking-tight">Yêu cầu dữ liệu cá nhân</h1>
        <p className="mt-4 text-muted-foreground">
          Theo DSGVO/GDPR, bạn có quyền truy cập, xuất hoặc yêu cầu xóa/ẩn danh dữ
          liệu cá nhân. Thành viên đã đăng nhập có thể thực hiện trực tiếp trong hồ
          sơ. Ngoài ra, gửi yêu cầu qua biểu mẫu dưới đây.
        </p>
        <Card className="mt-8">
          <CardContent className="pt-6">
            {/* Demo form — routed to support in production. */}
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email tài khoản</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Loại yêu cầu</Label>
                <select id="type" name="type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="access">Truy cập / xuất dữ liệu</option>
                  <option value="delete">Xóa / ẩn danh dữ liệu</option>
                  <option value="rectify">Chỉnh sửa dữ liệu</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="details">Chi tiết</Label>
                <textarea id="details" name="details" rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <Button type="submit" className="w-full">Gửi yêu cầu</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
