"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateMyProfile } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export function ProfileForm({
  phone,
  locale,
  marketingConsent,
  whatsappPhone,
  whatsappTransactional,
  whatsappMarketing,
}: {
  phone: string;
  locale: string;
  marketingConsent: boolean;
  whatsappPhone: string;
  whatsappTransactional: boolean;
  whatsappMarketing: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await updateMyProfile({
      phone: String(formData.get("phone") ?? ""),
      locale: formData.get("locale") as "vi" | "de" | "en",
      marketingConsent: formData.get("marketingConsent") === "on",
      whatsappPhone: String(formData.get("whatsappPhone") ?? ""),
      whatsappTransactional: formData.get("whatsappTransactional") === "on",
      whatsappMarketing: formData.get("whatsappMarketing") === "on",
    });
    setBusy(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã lưu" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Số điện thoại</Label>
        <Input id="phone" name="phone" defaultValue={phone} placeholder="+49 ..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locale">Ngôn ngữ</Label>
        <select id="locale" name="locale" defaultValue={locale} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="vi">Tiếng Việt</option>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="marketingConsent" defaultChecked={marketingConsent} className="h-4 w-4" />
        Đồng ý nhận thông tin ưu đãi qua email (marketing)
      </label>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366]" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.7.7-1 1.6-.9 2.6.3 1.4 1.1 2.6 2.3 3.5a8 8 0 0 0 4.6 1.9c.6 0 1.2-.2 1.6-.6.4-.4.6-1 .5-1.5 0-.1-.2-.2-.3-.2Z" />
          </svg>
          <span className="text-sm font-medium">Thông báo WhatsApp</span>
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappPhone">Số WhatsApp (nếu khác SĐT trên)</Label>
          <Input id="whatsappPhone" name="whatsappPhone" defaultValue={whatsappPhone} placeholder="+49 ..." />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="whatsappTransactional" defaultChecked={whatsappTransactional} className="mt-0.5 h-4 w-4" />
          <span>Nhận thông báo giao dịch (cộng điểm, đổi quà, voucher) qua WhatsApp</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="whatsappMarketing" defaultChecked={whatsappMarketing} className="mt-0.5 h-4 w-4" />
          <span>Nhận ưu đãi marketing qua WhatsApp</span>
        </label>
      </div>

      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Lưu thay đổi
      </Button>
    </form>
  );
}
