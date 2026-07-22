"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setBusinessStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { BusinessStatus } from "@prisma/client";

export function StatusControl({
  businessId,
  status,
}: {
  businessId: string;
  status: BusinessStatus;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function change(next: BusinessStatus) {
    if (next === "SUSPENDED" && !confirm("Khóa doanh nghiệp này? Nhân viên sẽ không đăng nhập được vào dashboard.")) {
      return;
    }
    setBusy(true);
    const result = await setBusinessStatus(businessId, next);
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã cập nhật trạng thái" });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {status !== "ACTIVE" ? (
        <Button onClick={() => change("ACTIVE")} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Kích hoạt
        </Button>
      ) : (
        <Button variant="destructive" onClick={() => change("SUSPENDED")} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Khóa doanh nghiệp
        </Button>
      )}
    </div>
  );
}
