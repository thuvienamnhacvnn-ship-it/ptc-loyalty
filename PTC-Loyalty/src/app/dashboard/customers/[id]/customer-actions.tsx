"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import {
  adjustCustomerPoints,
  toggleBlockCustomer,
  anonymizeCustomer,
  updateCustomer,
  deleteCustomer,
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

interface CustomerFields {
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null; // yyyy-mm-dd
}

export function CustomerActions({
  customerId,
  isBlocked,
  canManage,
  canOwn,
  customer,
}: {
  customerId: string;
  isBlocked: boolean;
  canManage: boolean;
  canOwn: boolean;
  customer: CustomerFields;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleEdit(formData: FormData) {
    setBusy(true);
    const result = await updateCustomer({
      customerId,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      birthDate: String(formData.get("birthDate") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã cập nhật khách hàng" });
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete(formData: FormData) {
    setBusy(true);
    const result = await deleteCustomer(customerId, String(formData.get("password") ?? ""));
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Không xóa được", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã xóa khách hàng" });
    setDeleteOpen(false);
    router.push("/dashboard/customers");
  }

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

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pencil className="h-4 w-4" /> Sửa
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin khách hàng</DialogTitle>
            <DialogDescription>
              Số điện thoại và email không được trùng với khách khác.
            </DialogDescription>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Tên *</Label>
                <Input id="firstName" name="firstName" defaultValue={customer.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Họ</Label>
                <Input id="lastName" name="lastName" defaultValue={customer.lastName ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={customer.phone ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Ngày sinh</Label>
                <Input id="birthDate" name="birthDate" type="date" defaultValue={customer.birthDate ?? ""} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Lưu thay đổi
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

      {/* Delete (owner only, requires password) */}
      {canOwn && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4" /> Xóa tài khoản
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xóa tài khoản khách hàng</DialogTitle>
              <DialogDescription>
                Hành động này <strong>không thể hoàn tác</strong> — toàn bộ điểm,
                giao dịch và voucher của khách sẽ bị xóa vĩnh viễn. Nhập mật khẩu
                của bạn để xác nhận.
              </DialogDescription>
            </DialogHeader>
            <form action={handleDelete} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu của bạn</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="destructive" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Xóa vĩnh viễn
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
