"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createCustomer, customerQrDataUrl, type CustomerQrResult } from "./actions";
import { MemberQrView } from "./member-qr-view";
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
  const [qr, setQr] = useState<CustomerQrResult | null>(null);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await createCustomer({
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      birthDate: String(formData.get("birthDate") ?? ""),
      marketingConsent: formData.get("marketingConsent") === "on",
    });
    if (!result.ok || !result.customerId) {
      setBusy(false);
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({
      variant: "success",
      title: "Đã thêm khách hàng",
      description:
        result.whatsapp === "sent"
          ? "Đã gửi thẻ QR qua WhatsApp."
          : result.whatsapp === "no_phone"
            ? undefined
            : result.whatsapp === "not_configured"
              ? "WhatsApp chưa cấu hình — chưa gửi thẻ."
              : result.whatsapp
                ? `WhatsApp: ${result.whatsapp}`
                : undefined,
    });
    router.refresh();
    // Fetch + show the fixed membership QR right away.
    const qrResult = await customerQrDataUrl(result.customerId);
    setBusy(false);
    setQr(qrResult);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQr(null); // reset back to the form when the dialog closes
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Thêm khách hàng
        </Button>
      </DialogTrigger>
      <DialogContent>
        {qr ? (
          <>
            <DialogHeader>
              <DialogTitle>Mã QR thành viên</DialogTitle>
              <DialogDescription>
                Đưa khách quét hoặc tải/in thẻ QR. Mã này cố định, không đổi.
              </DialogDescription>
            </DialogHeader>
            {qr.ok ? (
              <MemberQrView dataUrl={qr.dataUrl} name={qr.name} memberCode={qr.memberCode} />
            ) : (
              <p className="text-center text-sm text-destructive">{qr.error}</p>
            )}
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Xong</Button>
            </DialogFooter>
          </>
        ) : (
          <>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Ngày sinh</Label>
              <Input id="birthDate" name="birthDate" type="date" />
            </div>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
