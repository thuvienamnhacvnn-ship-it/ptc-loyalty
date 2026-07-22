"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resolveFraudAlert } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function ResolveButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const result = await resolveFraudAlert(alertId);
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã xử lý cảnh báo" });
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      Đánh dấu đã xử lý
    </Button>
  );
}
