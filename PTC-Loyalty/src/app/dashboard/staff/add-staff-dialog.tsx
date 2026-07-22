"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { addStaff } from "./actions";
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

interface Props {
  branches: { id: string; name: string }[];
  canAddManager: boolean;
}

export function AddStaffDialog({ branches, canAddManager }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await addStaff({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: formData.get("role") as "STAFF" | "BUSINESS_MANAGER",
      branchId: String(formData.get("branchId") ?? "") || undefined,
      maxPointsGrant: formData.get("maxPointsGrant")
        ? Number(formData.get("maxPointsGrant"))
        : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã thêm nhân viên" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" /> Thêm nhân viên
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm nhân viên</DialogTitle>
          <DialogDescription>
            Nhân viên đăng nhập bằng email và mật khẩu bạn đặt.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Họ tên *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu tạm *</Label>
            <Input id="password" name="password" type="text" placeholder="Tối thiểu 8 ký tự" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="role">Vai trò</Label>
              <select id="role" name="role" defaultValue="STAFF" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="STAFF">Nhân viên</option>
                {canAddManager && <option value="BUSINESS_MANAGER">Quản lý</option>}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchId">Chi nhánh</Label>
              <select id="branchId" name="branchId" defaultValue="" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Tất cả</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxPointsGrant">Giới hạn điểm cấp / giao dịch</Label>
            <Input id="maxPointsGrant" name="maxPointsGrant" type="number" placeholder="Không giới hạn" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Thêm nhân viên
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
