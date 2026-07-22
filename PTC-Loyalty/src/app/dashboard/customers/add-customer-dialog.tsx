"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createCustomer } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export function AddCustomerDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await createCustomer({
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      marketingConsent: formData.get("marketingConsent") === "on",
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã thêm khách hàng" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Thêm khách hàng
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm khách hàng mới</DialogTitle>
          <DialogDescription>
            Khách sẽ nhận mã thành viên và thẻ QR ngay lập tức.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Tên *</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Họ</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+49 ..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="marketingConsent" className="h-4 w-4" />
            Đồng ý nhận thông tin marketing
          </label>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo khách hàng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
