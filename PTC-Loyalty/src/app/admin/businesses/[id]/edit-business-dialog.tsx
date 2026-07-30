"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { updateBusinessInfo } from "@/app/admin/actions";
import { BUSINESS_TYPES } from "@/lib/business-types";
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

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

interface Props {
  businessId: string;
  business: {
    name: string;
    type: string;
    email: string;
    phone: string | null;
    addressLine: string | null;
    city: string | null;
    locale: string;
  };
}

export function EditBusinessDialog({ businessId, business }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await updateBusinessInfo(businessId, {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      addressLine: String(formData.get("addressLine") ?? ""),
      city: String(formData.get("city") ?? ""),
      locale: formData.get("locale") as "vi" | "de" | "en",
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã cập nhật thông tin" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Sửa thông tin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa thông tin doanh nghiệp</DialogTitle>
          <DialogDescription>
            Thay đổi áp dụng ngay cho dashboard và trang công khai của tenant.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên doanh nghiệp *</Label>
            <Input id="name" name="name" defaultValue={business.name} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Loại hình</Label>
              <select
                id="type"
                name="type"
                defaultValue={business.type}
                className={selectClass}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">Ngôn ngữ</Label>
              <select
                id="locale"
                name="locale"
                defaultValue={business.locale}
                className={selectClass}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email doanh nghiệp *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={business.email}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Điện thoại</Label>
              <Input id="phone" name="phone" defaultValue={business.phone ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine">Địa chỉ</Label>
            <Input
              id="addressLine"
              name="addressLine"
              defaultValue={business.addressLine ?? ""}
              placeholder="Straße und Hausnummer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Thành phố</Label>
            <Input id="city" name="city" defaultValue={business.city ?? ""} />
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
  );
}
