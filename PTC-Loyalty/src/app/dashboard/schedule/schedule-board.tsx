"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createAssignment, deleteAssignment, type ScheduleState } from "./actions";
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
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { WEEKDAY_LABELS_VI } from "@/lib/schedule";

export interface BoardStaff {
  id: string;
  name: string;
  departmentName: string | null;
  /** Giờ cam kết mỗi tuần, để so với giờ đã xếp. */
  weeklyHours: number | null;
}

export interface BoardShift {
  id: string;
  staffId: string;
  dateKey: string;
  label: string;
  timeLabel: string;
  colorHex: string;
  departmentName: string | null;
  spanMin: number;
  confirmed: boolean;
}

export interface BoardAbsence {
  staffId: string;
  dateKey: string;
  label: string;
}

export interface BoardTemplate {
  id: string;
  name: string;
  timeLabel: string;
  breakMin: number;
}

export interface BoardDepartment {
  id: string;
  name: string;
}

interface Props {
  weekKeys: string[];
  staff: BoardStaff[];
  shifts: BoardShift[];
  absences: BoardAbsence[];
  templates: BoardTemplate[];
  departments: BoardDepartment[];
  canManage: boolean;
}

/** "2026-08-24" → "24.08." — đầu cột chỉ cần ngày và tháng. */
function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}.${m}.`;
}

export function ScheduleBoard({
  weekKeys,
  staff,
  shifts,
  absences,
  templates,
  departments,
  canManage,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<{ staff: BoardStaff; dateKey: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [useCustomTime, setUseCustomTime] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);

  async function submitAssign(formData: FormData) {
    if (!target) return;
    formData.set("staffId", target.staff.id);
    formData.set("date", target.dateKey);
    if (!useCustomTime) {
      formData.delete("startTime");
      formData.delete("endTime");
    }
    setBusy(true);
    const result: ScheduleState = await createAssignment({}, formData);
    setBusy(false);

    if (!result.ok) {
      toast({ variant: "destructive", title: "Không xếp được ca", description: result.error });
      return;
    }
    toast({
      variant: result.warning ? "default" : "success",
      title: "Đã xếp ca",
      description: result.warning,
    });
    setTarget(null);
    setUseCustomTime(false);
    router.refresh();
  }

  async function removeShift(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await deleteAssignment(fd);
    router.refresh();
  }

  return (
    <>
      {/* Bảng tuần rộng hơn màn hình điện thoại nên cuộn ngang trong khung
          riêng — để cả trang cuộn ngang thì thanh điều hướng cũng trôi theo. */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 w-48 border-b bg-muted/50 p-3 text-left font-medium">
                Nhân viên
              </th>
              {weekKeys.map((key, i) => (
                <th
                  key={key}
                  className={`border-b border-l p-3 text-center font-medium ${
                    key === todayKey ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <span className="block">{WEEKDAY_LABELS_VI[i]}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {shortDate(key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const mine = shifts.filter((sh) => sh.staffId === s.id);
              const totalMin = mine.reduce((sum, sh) => sum + sh.spanMin, 0);
              return (
                <tr key={s.id} className="align-top">
                  <th className="sticky left-0 z-10 border-b bg-background p-3 text-left font-normal">
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.departmentName ?? "Chưa có bộ phận"}
                    </span>
                    <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                      {(totalMin / 60).toFixed(1)}h
                      {s.weeklyHours ? ` / ${s.weeklyHours}h` : ""}
                    </span>
                  </th>

                  {weekKeys.map((key) => {
                    const cell = mine.filter((sh) => sh.dateKey === key);
                    const off = absences.find((a) => a.staffId === s.id && a.dateKey === key);
                    return (
                      <td
                        key={key}
                        className={`border-b border-l p-2 ${off ? "bg-destructive/5" : ""}`}
                      >
                        {off ? (
                          <span className="block rounded-md bg-destructive/10 px-2 py-1 text-center text-xs text-destructive">
                            {off.label}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {cell.map((sh) => (
                              <div
                                key={sh.id}
                                className="group flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white"
                                style={{ backgroundColor: sh.colorHex }}
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="block font-medium">{sh.label}</span>
                                  <span className="block tabular-nums opacity-90">
                                    {sh.timeLabel}
                                  </span>
                                </span>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => removeShift(sh.id)}
                                    className="opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                                    aria-label={`Xoá ca ${sh.label}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setTarget({ staff: s, dateKey: key })}
                                className="flex w-full items-center justify-center rounded-md border border-dashed py-1 text-muted-foreground transition hover:border-primary hover:text-primary"
                                aria-label={`Xếp ca cho ${s.name} ngày ${key}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setUseCustomTime(false);
          }
        }}
      >
        <DialogContent>
          <form action={submitAssign}>
            <DialogHeader>
              <DialogTitle>Xếp ca</DialogTitle>
              <DialogDescription>
                {target ? `${target.staff.name} — ngày ${shortDate(target.dateKey)}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="shiftTemplateId">Ca</Label>
                <select
                  id="shiftTemplateId"
                  name="shiftTemplateId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(e) => setUseCustomTime(e.target.value === "custom")}
                  defaultValue={templates[0]?.id ?? "custom"}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.timeLabel}
                      {t.breakMin > 0 ? ` (nghỉ ${t.breakMin}′)` : ""}
                    </option>
                  ))}
                  <option value="custom">Giờ khác…</option>
                </select>
              </div>

              {useCustomTime && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Từ</Label>
                    <Input id="startTime" name="startTime" type="time" defaultValue="09:00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Đến</Label>
                    <Input id="endTime" name="endTime" type="time" defaultValue="17:00" />
                  </div>
                </div>
              )}

              {departments.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="departmentId">Bộ phận</Label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue="none"
                  >
                    <option value="none">Theo bộ phận của nhân viên</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Input id="note" name="note" placeholder="Ví dụ: trực thay chị Lan" />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Xếp ca
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
