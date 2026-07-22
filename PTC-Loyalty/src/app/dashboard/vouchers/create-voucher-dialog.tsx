"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createVoucher } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export function CreateVoucherDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await createVoucher({
      title: String(formData.get("title") ?? ""),
      code: String(formData.get("code") ?? ""),
      discountType: formData.get("discountType") as "percent" | "fixed" | "free_item",
      discountValue: Number(formData.get("discountValue")),
      pointsCost: Number(formData.get("pointsCost")),
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : undefined,
      expiresAt: String(formData.get("expiresAt") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã tạo voucher" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Tạo voucher
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo voucher mới</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề *</Label>
            <Input id="title" name="title" placeholder="Giảm 10% hóa đơn" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="code">Mã (tùy chọn)</Label>
              <Input id="code" name="code" placeholder="Tự tạo nếu trống" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountType">Loại</Label>
              <select id="discountType" name="discountType" defaultValue="percent" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="percent">Giảm %</option>
                <option value="fixed">Giảm số tiền (€)</option>
                <option value="free_item">Tặng món</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="discountValue">Giá trị</Label>
              <Input id="discountValue" name="discountValue" type="number" step="0.01" defaultValue={10} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pointsCost">Điểm cần đổi</Label>
              <Input id="pointsCost" name="pointsCost" type="number" defaultValue={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Số lượng</Label>
              <Input id="quantity" name="quantity" type="number" placeholder="Không giới hạn" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Hết hạn</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo voucher
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
