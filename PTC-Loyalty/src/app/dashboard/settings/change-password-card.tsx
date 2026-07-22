"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { changePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export function ChangePasswordCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Mật khẩu mới tối thiểu 8 ký tự" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Xác nhận mật khẩu không khớp" });
      return;
    }

    setBusy(true);
    const result = await changePassword({ currentPassword, newPassword });
    setBusy(false);

    if (result.ok) {
      toast({ variant: "success", title: "Đã đổi mật khẩu" });
      // Clear the form.
      (document.getElementById("change-password-form") as HTMLFormElement | null)?.reset();
    } else {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đổi mật khẩu</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="change-password-form" action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Cập nhật mật khẩu
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
