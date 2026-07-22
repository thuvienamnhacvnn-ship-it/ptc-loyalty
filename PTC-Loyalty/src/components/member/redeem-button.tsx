"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { redeemReward, claimVoucher } from "@/app/member/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function RedeemButton({
  id,
  kind,
  disabled,
  label,
}: {
  id: string;
  kind: "reward" | "voucher";
  disabled?: boolean;
  label: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const result =
      kind === "reward" ? await redeemReward(id) : await claimVoucher(id);
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Không thành công", description: result.error });
      return;
    }
    toast({ variant: "success", title: kind === "reward" ? "Đổi quà thành công" : "Đã nhận voucher" });
    router.refresh();
  }

  return (
    <Button size="sm" onClick={onClick} disabled={busy || disabled} className="w-full">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}
