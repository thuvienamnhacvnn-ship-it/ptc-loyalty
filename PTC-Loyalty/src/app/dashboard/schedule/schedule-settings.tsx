"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  createDepartment,
  createShiftTemplate,
  deleteDepartment,
  deleteShiftTemplate,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

interface TemplateRow {
  id: string;
  name: string;
  timeLabel: string;
  breakMin: number;
  departmentName: string | null;
}

interface DepartmentRow {
  id: string;
  name: string;
  colorHex: string;
}

interface Props {
  templates: TemplateRow[];
  departments: DepartmentRow[];
  /** Quán ăn thì hiện phần bộ phận; tiệm nail thường không cần. */
  showDepartments: boolean;
}

export function ScheduleSettings({ templates, departments, showDepartments }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"shift" | "dept" | null>(null);
  const [openShift, setOpenShift] = useState(false);
  const [openDept, setOpenDept] = useState(false);

  async function addShift(formData: FormData) {
    setBusy("shift");
    const result = await createShiftTemplate({}, formData);
    setBusy(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Không thêm được ca", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã thêm ca" });
    setOpenShift(false);
    router.refresh();
  }

  async function addDept(formData: FormData) {
    setBusy("dept");
    const result = await createDepartment({}, formData);
    setBusy(null);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Không thêm được bộ phận", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã thêm bộ phận" });
    setOpenDept(false);
    router.refresh();
  }

  async function remove(kind: "shift" | "dept", id: string) {
    const fd = new FormData();
    fd.set("id", id);
    if (kind === "shift") await deleteShiftTemplate(fd);
    else await deleteDepartment(fd);
    router.refresh();
  }

  return (
    <div className={`grid gap-4 ${showDepartments ? "lg:grid-cols-2" : ""}`}>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Các ca làm</CardTitle>
            <CardDescription>Khuôn ca dùng lại mỗi tuần.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpenShift((v) => !v)}>
            <Plus className="h-4 w-4" /> Thêm ca
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{t.name}</span>{" "}
                <span className="tabular-nums text-muted-foreground">{t.timeLabel}</span>
                {t.breakMin > 0 && (
                  <span className="text-muted-foreground"> · nghỉ {t.breakMin}′</span>
                )}
                {t.departmentName && (
                  <span className="block text-xs text-muted-foreground">{t.departmentName}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove("shift", t.id)}
                className="text-muted-foreground transition hover:text-destructive"
                aria-label={`Xoá ca ${t.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có ca nào.</p>
          )}

          {openShift && (
            <form action={addShift} className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="shift-name">Tên ca</Label>
                <Input id="shift-name" name="name" placeholder="Ca tối" required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="shift-start">Từ</Label>
                  <Input id="shift-start" name="startTime" type="time" defaultValue="16:00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-end">Đến</Label>
                  <Input id="shift-end" name="endTime" type="time" defaultValue="23:00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-break">Nghỉ (′)</Label>
                  <Input id="shift-break" name="breakMin" type="number" min={0} defaultValue={30} />
                </div>
              </div>
              {departments.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="shift-dept">Bộ phận</Label>
                  <select
                    id="shift-dept"
                    name="departmentId"
                    defaultValue="none"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">Mọi bộ phận</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button type="submit" size="sm" disabled={busy === "shift"}>
                {busy === "shift" && <Loader2 className="h-4 w-4 animate-spin" />} Lưu ca
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {showDepartments && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Bộ phận</CardTitle>
              <CardDescription>Küche, Bar-Service, chạy bàn…</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenDept((v) => !v)}>
              <Plus className="h-4 w-4" /> Thêm
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: d.colorHex }}
                    aria-hidden
                  />
                  {d.name}
                </span>
                <button
                  type="button"
                  onClick={() => remove("dept", d.id)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label={`Xoá bộ phận ${d.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {departments.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa chia bộ phận.</p>
            )}

            {openDept && (
              <form action={addDept} className="space-y-3 rounded-lg border p-3">
                <div className="space-y-2">
                  <Label htmlFor="dept-name">Tên bộ phận</Label>
                  <Input id="dept-name" name="name" placeholder="Küche" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dept-color">Màu</Label>
                  <Input
                    id="dept-color"
                    name="colorHex"
                    type="color"
                    defaultValue="#145DFF"
                    className="h-10 w-20 p-1"
                  />
                </div>
                <Button type="submit" size="sm" disabled={busy === "dept"}>
                  {busy === "dept" && <Loader2 className="h-4 w-4 animate-spin" />} Lưu bộ phận
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
