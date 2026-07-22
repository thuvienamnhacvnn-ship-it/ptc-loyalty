"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createBranch } from "./actions";
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

export function CreateBranchDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await createBranch({
      name: String(formData.get("name") ?? ""),
      city: String(formData.get("city") ?? ""),
      addressLine: String(formData.get("addressLine") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      openingHours: String(formData.get("openingHours") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã thêm chi nhánh" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Thêm chi nhánh
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm chi nhánh</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên chi nhánh *</Label>
            <Input id="name" name="name" placeholder="Chi nhánh Kreuzberg" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">Thành phố</Label>
              <Input id="city" name="city" placeholder="Berlin" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Điện thoại</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine">Địa chỉ</Label>
            <Input id="addressLine" name="addressLine" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingHours">Giờ mở cửa</Label>
            <Input id="openingHours" name="openingHours" placeholder="Mo-Sa 10:00-22:00" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Thêm chi nhánh
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
