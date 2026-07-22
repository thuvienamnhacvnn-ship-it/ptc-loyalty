"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { createAndSendCampaign } from "./actions";
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

export function CreateCampaignDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await createAndSendCampaign({
      name: String(formData.get("name") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      audience: formData.get("audience") as "all" | "consented" | "inactive_30d" | "top_tier",
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({
      variant: "success",
      title: "Đã gửi chiến dịch",
      description: `${result.recipients} khách hàng nhận được thông báo.`,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="h-4 w-4" /> Tạo chiến dịch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo & gửi chiến dịch</DialogTitle>
          <DialogDescription>
            Gửi thông báo trong hệ thống. Email được mô phỏng (sẵn sàng tích hợp
            Resend).
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên chiến dịch *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Nhóm khách hàng</Label>
            <select id="audience" name="audience" defaultValue="consented" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="consented">Khách đồng ý marketing</option>
              <option value="all">Tất cả khách hàng</option>
              <option value="inactive_30d">Khách lâu chưa quay lại (30 ngày)</option>
              <option value="top_tier">Khách hạng cao (Gold+)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Tiêu đề *</Label>
            <Input id="subject" name="subject" placeholder="Ưu đãi cuối tuần!" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Nội dung *</Label>
            <textarea id="body" name="body" rows={4} required className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Gửi ngay
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
