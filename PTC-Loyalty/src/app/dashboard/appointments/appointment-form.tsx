"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { createAppointment, type AppointmentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  memberCode: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Lưu lịch hẹn
    </Button>
  );
}

export function AppointmentForm({
  customers,
  staff,
  defaultDate,
}: {
  customers: CustomerOption[];
  staff: StaffOption[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState<AppointmentState, FormData>(
    createAppointment,
    {},
  );
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? customers
        .filter((c) => {
          const q = query.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? "").includes(q) ||
            c.memberCode.toLowerCase().includes(q)
          );
        })
        .slice(0, 50)
    : customers.slice(0, 50);

  return (
    <form action={formAction} className="space-y-4">
      {state.ok && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          Đã lưu lịch hẹn và nhắn xác nhận cho khách.
        </div>
      )}
      {state.warning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {state.warning}
        </div>
      )}
      {state.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="customer-search">Tìm khách</Label>
        <Input
          id="customer-search"
          placeholder="Tên, số điện thoại hoặc mã thành viên"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerId">Khách hàng</Label>
        <select
          id="customerId"
          name="customerId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {filtered.length === 0 && <option value="">Không tìm thấy khách nào</option>}
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.phone ? `· ${c.phone}` : ""} · {c.memberCode}
            </option>
          ))}
        </select>
        {state.fieldErrors?.customerId && (
          <p className="text-xs text-destructive">{state.fieldErrors.customerId[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Chỉ khách đã là thành viên mới nhận được tin nhắn — khách mới thì cho
          quét mã QR đăng ký trước.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="date">Ngày</Label>
          <Input id="date" name="date" type="date" required defaultValue={defaultDate} />
          {state.fieldErrors?.date && (
            <p className="text-xs text-destructive">{state.fieldErrors.date[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Giờ</Label>
          <Input id="time" name="time" type="time" required defaultValue="10:00" />
          {state.fieldErrors?.time && (
            <p className="text-xs text-destructive">{state.fieldErrors.time[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="durationMin">Kéo dài (phút)</Label>
          <Input
            id="durationMin"
            name="durationMin"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={60}
          />
          {state.fieldErrors?.durationMin && (
            <p className="text-xs text-destructive">{state.fieldErrors.durationMin[0]}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service">Dịch vụ</Label>
          <Input
            id="service"
            name="service"
            maxLength={120}
            placeholder="Neumodellage, Auffüllen, Pediküre…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staffId">Thợ phụ trách</Label>
          <select
            id="staffId"
            name="staffId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="none">Chưa phân công</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú</Label>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={1000}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
