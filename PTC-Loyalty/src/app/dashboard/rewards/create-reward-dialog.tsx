"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createReward } from "./actions";
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

export function CreateRewardDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await createReward({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      pointsCost: Number(formData.get("pointsCost")),
      stock: formData.get("stock") ? Number(formData.get("stock")) : undefined,
      imageUrl: String(formData.get("imageUrl") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã thêm quà tặng" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Thêm quà
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm quà tặng</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên quà *</Label>
            <Input id="name" name="name" placeholder="Cà phê miễn phí" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Input id="description" name="description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pointsCost">Điểm cần đổi *</Label>
              <Input id="pointsCost" name="pointsCost" type="number" defaultValue={100} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Tồn kho</Label>
              <Input id="stock" name="stock" type="number" placeholder="Không giới hạn" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Ảnh (URL)</Label>
            <Input id="imageUrl" name="imageUrl" type="url" placeholder="https://..." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Thêm quà
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
