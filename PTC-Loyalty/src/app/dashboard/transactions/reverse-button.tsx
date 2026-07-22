"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { reverseTxnAction } from "./actions";
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

export function ReverseButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await reverseTxnAction({
      transactionId,
      reason: String(formData.get("reason") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã hoàn tác giao dịch" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Undo2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hoàn tác giao dịch</DialogTitle>
          <DialogDescription>
            Điểm sẽ được điều chỉnh ngược lại. Hành động được ghi vào nhật ký.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do</Label>
            <Input id="reason" name="reason" placeholder="VD: Nhập nhầm số tiền" required />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận hoàn tác
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
