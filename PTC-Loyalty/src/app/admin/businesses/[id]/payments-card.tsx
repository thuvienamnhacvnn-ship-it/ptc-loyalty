"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Check, Trash2, Receipt } from "lucide-react";
import { recordPayment, setPaymentStatus, deletePayment } from "@/app/admin/actions";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANT,
} from "@/lib/billing";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { PaymentMethod, PaymentStatus } from "@prisma/client";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export interface PaymentRow {
  id: string;
  amount: number; // cents
  method: PaymentMethod;
  status: PaymentStatus;
  periodStart: string | null;
  periodEnd: string | null;
  reference: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  recordedBy: string | null;
}

interface Props {
  businessId: string;
  /** Plan price in EUR, prefilled as the default amount. */
  suggestedAmount: number;
  payments: PaymentRow[];
}

export function PaymentsCard({ businessId, suggestedAmount, payments }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const collected = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    const result = await recordPayment({
      businessId,
      amountEur: Number(formData.get("amountEur")),
      method: formData.get("method") as PaymentMethod,
      status: formData.get("status") as PaymentStatus,
      months: Number(formData.get("months") ?? 1),
      periodStart: String(formData.get("periodStart") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      note: String(formData.get("note") ?? ""),
      extendSubscription: formData.get("extendSubscription") === "on",
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã ghi nhận thanh toán" });
    setOpen(false);
    router.refresh();
  }

  async function markPaid(id: string) {
    setRowBusy(id);
    const result = await setPaymentStatus(id, "PAID");
    setRowBusy(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã đánh dấu đã thu" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Xóa khoản thanh toán này? Hạn thuê bao đã gia hạn sẽ không tự lùi lại.")) {
      return;
    }
    setRowBusy(id);
    const result = await deletePayment(id);
    setRowBusy(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã xóa" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Thanh toán</CardTitle>
          <p className="text-sm text-muted-foreground">
            Đã thu {formatCurrency(collected / 100)} · {payments.length} khoản
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Ghi nhận
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ghi nhận thanh toán</DialogTitle>
              <DialogDescription>
                Dùng khi tiền đã về tài khoản (chuyển khoản / SEPA). Ghi nhận
                &quot;Đã thu&quot; sẽ gia hạn thuê bao và kích hoạt lại nếu đang
                quá hạn.
              </DialogDescription>
            </DialogHeader>
            <form action={onSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amountEur">Số tiền (€) *</Label>
                  <Input
                    id="amountEur"
                    name="amountEur"
                    type="number"
                    step="0.01"
                    min="0.01"
                    defaultValue={suggestedAmount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="months">Số tháng</Label>
                  <Input
                    id="months"
                    name="months"
                    type="number"
                    min="1"
                    max="36"
                    defaultValue={1}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="method">Hình thức</Label>
                  <select
                    id="method"
                    name="method"
                    defaultValue="BANK_TRANSFER"
                    className={selectClass}
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Trạng thái</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="PAID"
                    className={selectClass}
                  >
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Kỳ bắt đầu từ</Label>
                <Input id="periodStart" name="periodStart" type="date" />
                <p className="text-xs text-muted-foreground">
                  Để trống = nối tiếp kỳ hiện tại.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Mã tham chiếu / số hóa đơn</Label>
                <Input id="reference" name="reference" placeholder="RE-2026-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Input id="note" name="note" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="extendSubscription"
                  defaultChecked
                  className="h-4 w-4 rounded border-input"
                />
                Gia hạn thuê bao và kích hoạt lại
              </label>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ghi nhận
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Receipt className="h-8 w-8 opacity-40" />
            Chưa có khoản thanh toán nào.
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatCurrency(p.amount / 100)}
                    </span>
                    <Badge variant={PAYMENT_STATUS_VARIANT[p.status]}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.periodStart && p.periodEnd && (
                      <>
                        {" · "}
                        {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                      </>
                    )}
                    {p.reference && ` · ${p.reference}`}
                    {p.paidAt && ` · thu ${formatDate(p.paidAt)}`}
                    {p.recordedBy && ` · ${p.recordedBy}`}
                  </p>
                  {p.note && (
                    <p className="text-xs text-muted-foreground">{p.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {p.status !== "PAID" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rowBusy === p.id}
                      onClick={() => markPaid(p.id)}
                    >
                      {rowBusy === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Đã thu
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={rowBusy === p.id}
                    onClick={() => remove(p.id)}
                    aria-label="Xóa khoản thanh toán"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
