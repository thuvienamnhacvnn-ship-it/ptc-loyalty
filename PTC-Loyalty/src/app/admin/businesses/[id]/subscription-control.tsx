"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { updateSubscription } from "@/app/admin/actions";
import { PLANS } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing";
import { formatCurrency } from "@/lib/format";
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
import type { SubscriptionStatus } from "@prisma/client";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** `<input type="date">` needs a bare YYYY-MM-DD value. */
function dateValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

interface Props {
  businessId: string;
  subscription: {
    planTier: "BASIC" | "BUSINESS" | "PREMIUM";
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
}

export function SubscriptionControl({ businessId, subscription }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await updateSubscription(businessId, {
      planTier: formData.get("planTier") as "BASIC" | "BUSINESS" | "PREMIUM",
      status: formData.get("status") as SubscriptionStatus,
      trialEndsAt: String(formData.get("trialEndsAt") ?? ""),
      currentPeriodEnd: String(formData.get("currentPeriodEnd") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã cập nhật thuê bao" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CreditCard className="h-4 w-4" /> Đổi gói / trạng thái
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thuê bao</DialogTitle>
          <DialogDescription>
            Đổi gói áp dụng giá mới ngay ở kỳ tiếp theo. Các khoản đã thu giữ
            nguyên số tiền đã ghi nhận.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="planTier">Gói</Label>
            <select
              id="planTier"
              name="planTier"
              defaultValue={subscription?.planTier ?? "BASIC"}
              className={selectClass}
            >
              {PLANS.map((p) => (
                <option key={p.tier} value={p.tier}>
                  {p.name} — {formatCurrency(p.priceMonthly)}/tháng
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select
              id="status"
              name="status"
              defaultValue={subscription?.status ?? "TRIALING"}
              className={selectClass}
            >
              {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trialEndsAt">Hết hạn dùng thử</Label>
              <Input
                id="trialEndsAt"
                name="trialEndsAt"
                type="date"
                defaultValue={dateValue(subscription?.trialEndsAt)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPeriodEnd">Đã trả đến</Label>
              <Input
                id="currentPeriodEnd"
                name="currentPeriodEnd"
                type="date"
                defaultValue={dateValue(subscription?.currentPeriodEnd)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu thuê bao
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
