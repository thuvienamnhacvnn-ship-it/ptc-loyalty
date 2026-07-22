"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  adjustCustomerPoints,
  toggleBlockCustomer,
  anonymizeCustomer,
} from "../actions";
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

export function CustomerActions({
  customerId,
  isBlocked,
  canManage,
  canOwn,
}: {
  customerId: string;
  isBlocked: boolean;
  canManage: boolean;
  canOwn: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  async function handleAdjust(formData: FormData) {
    setBusy(true);
    const result = await adjustCustomerPoints({
      customerId,
      pointsDelta: Number(formData.get("pointsDelta")),
      reason: String(formData.get("reason") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã điều chỉnh điểm" });
    setAdjustOpen(false);
    router.refresh();
  }

  async function handleBlock() {
    setBusy(true);
    const result = await toggleBlockCustomer(customerId);
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    router.refresh();
  }

  async function handleAnonymize() {
    if (!confirm("Ẩn danh toàn bộ dữ liệu cá nhân của khách này? Hành động không thể hoàn tác.")) return;
    setBusy(true);
    const result = await anonymizeCustomer(customerId);
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã ẩn danh dữ liệu (GDPR)" });
    router.refresh();
  }

  if (!canManage) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Điều chỉnh điểm</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Điều chỉnh điểm thủ công</DialogTitle>
            <DialogDescription>
              Nhập số dương để cộng, số âm để trừ. Lý do sẽ được ghi vào nhật ký.
            </DialogDescription>
          </DialogHeader>
          <form action={handleAdjust} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pointsDelta">Số điểm (+/-)</Label>
              <Input id="pointsDelta" name="pointsDelta" type="number" placeholder="VD: -50" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Lý do</Label>
              <Input id="reason" name="reason" placeholder="VD: Bù điểm khiếu nại" required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Áp dụng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button variant="outline" onClick={handleBlock} disabled={busy}>
        {isBlocked ? "Mở khóa" : "Khóa tài khoản"}
      </Button>

      {canOwn && (
        <Button variant="destructive" onClick={handleAnonymize} disabled={busy}>
          Ẩn danh (GDPR)
        </Button>
      )}
    </div>
  );
}
