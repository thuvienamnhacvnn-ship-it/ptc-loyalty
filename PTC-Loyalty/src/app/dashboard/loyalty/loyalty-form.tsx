"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveLoyaltySettings } from "../settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  settings: {
    amountPerPoint: number;
    pointsPerUnit: number;
    rounding: string;
    minPointsPerTxn: number;
    maxPointsPerTxn: number | null;
    signupBonus: number;
    birthdayBonus: number;
    referralBonus: number;
    pointsExpiryDays: number | null;
  };
  readOnly: boolean;
}

export function LoyaltyForm({ settings, readOnly }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await saveLoyaltySettings({
      amountPerPoint: Number(formData.get("amountPerPoint")),
      pointsPerUnit: Number(formData.get("pointsPerUnit")),
      rounding: formData.get("rounding") as "floor" | "round" | "ceil",
      minPointsPerTxn: Number(formData.get("minPointsPerTxn")),
      maxPointsPerTxn: formData.get("maxPointsPerTxn")
        ? Number(formData.get("maxPointsPerTxn"))
        : undefined,
      signupBonus: Number(formData.get("signupBonus")),
      birthdayBonus: Number(formData.get("birthdayBonus")),
      referralBonus: Number(formData.get("referralBonus")),
      pointsExpiryDays: formData.get("pointsExpiryDays")
        ? Number(formData.get("pointsExpiryDays"))
        : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã lưu quy tắc tích điểm" });
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quy tắc tích điểm cơ bản</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amountPerPoint">Số tiền (€) cho mỗi mốc</Label>
            <Input id="amountPerPoint" name="amountPerPoint" type="number" step="0.01" defaultValue={settings.amountPerPoint} disabled={readOnly} />
            <p className="text-xs text-muted-foreground">VD: 1 → 1€; 10 → 10€.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointsPerUnit">Điểm nhận mỗi mốc</Label>
            <Input id="pointsPerUnit" name="pointsPerUnit" type="number" defaultValue={settings.pointsPerUnit} disabled={readOnly} />
            <p className="text-xs text-muted-foreground">
              {settings.amountPerPoint}€ = {settings.pointsPerUnit} điểm.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rounding">Cách làm tròn</Label>
            <select id="rounding" name="rounding" defaultValue={settings.rounding} disabled={readOnly} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="floor">Làm tròn xuống</option>
              <option value="round">Làm tròn gần nhất</option>
              <option value="ceil">Làm tròn lên</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointsExpiryDays">Điểm hết hạn sau (ngày)</Label>
            <Input id="pointsExpiryDays" name="pointsExpiryDays" type="number" defaultValue={settings.pointsExpiryDays ?? ""} placeholder="Không hết hạn" disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minPointsPerTxn">Điểm tối thiểu / giao dịch</Label>
            <Input id="minPointsPerTxn" name="minPointsPerTxn" type="number" defaultValue={settings.minPointsPerTxn} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxPointsPerTxn">Điểm tối đa / giao dịch</Label>
            <Input id="maxPointsPerTxn" name="maxPointsPerTxn" type="number" defaultValue={settings.maxPointsPerTxn ?? ""} placeholder="Không giới hạn" disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Điểm thưởng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="signupBonus">Đăng ký</Label>
            <Input id="signupBonus" name="signupBonus" type="number" defaultValue={settings.signupBonus} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthdayBonus">Sinh nhật</Label>
            <Input id="birthdayBonus" name="birthdayBonus" type="number" defaultValue={settings.birthdayBonus} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referralBonus">Giới thiệu bạn</Label>
            <Input id="referralBonus" name="referralBonus" type="number" defaultValue={settings.referralBonus} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Lưu quy tắc
        </Button>
      )}
    </form>
  );
}
