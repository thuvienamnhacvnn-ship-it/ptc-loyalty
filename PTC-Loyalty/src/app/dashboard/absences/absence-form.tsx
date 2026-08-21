"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { reportAbsence, type AbsenceState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AbsenceStaffOption {
  id: string;
  name: string;
}

interface Props {
  staff: AbsenceStaffOption[];
  /** Nhân viên thường chỉ báo được cho chính mình nên khoá ô chọn người. */
  lockedStaffId?: string;
  isManager: boolean;
}

function SubmitButton({ isManager }: { isManager: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {isManager ? "Ghi nhận nghỉ" : "Gửi báo nghỉ"}
    </Button>
  );
}

export function AbsenceForm({ staff, lockedStaffId, isManager }: Props) {
  const [state, formAction] = useActionState<AbsenceState, FormData>(reportAbsence, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}
      {state.ok && !state.warning && (
        <p className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Đã ghi nhận.
        </p>
      )}
      {state.ok && state.warning && (
        <p className="flex items-center gap-2 rounded-md bg-warning/15 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {state.warning}
        </p>
      )}

      {lockedStaffId ? (
        <input type="hidden" name="staffId" value={lockedStaffId} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="staffId">Nhân viên</Label>
          <select
            id="staffId"
            name="staffId"
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="type">Loại nghỉ</Label>
        <select
          id="type"
          name="type"
          defaultValue="SICK"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="SICK">Báo ốm (Krankmeldung)</option>
          <option value="VACATION">Nghỉ phép (Urlaub)</option>
          <option value="UNPAID">Nghỉ không lương</option>
          <option value="TRAINING">Đi đào tạo</option>
          <option value="OTHER">Lý do khác</option>
        </select>
        {!isManager && (
          <p className="text-xs text-muted-foreground">
            Báo ốm có hiệu lực ngay. Nghỉ phép phải chờ quản lý duyệt.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Từ ngày</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Đến hết ngày</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú</Label>
        <Input id="note" name="note" placeholder="Ví dụ: sốt, đã báo bác sĩ" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasCertificate" className="h-4 w-4 rounded border-input" />
        Đã có giấy bác sĩ (AU-Bescheinigung)
      </label>

      <SubmitButton isManager={isManager} />
    </form>
  );
}
