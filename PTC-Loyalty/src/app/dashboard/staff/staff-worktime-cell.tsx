"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { IdCard, Loader2, Printer, RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  getStaffBadge,
  revokeStaffBadge,
  updateStaffWorkProfile,
  type StaffQrPayload,
} from "./worktime-actions";
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

export interface WorkProfile {
  staffId: string;
  name: string;
  departmentId: string | null;
  employeeNo: string | null;
  phone: string | null;
  weeklyHours: number | null;
  hourlyWageCents: number | null;
}

interface Props {
  profile: WorkProfile;
  departments: { id: string; name: string }[];
  canSetWage: boolean;
}

/** Hai nút cuối mỗi dòng nhân viên: in thẻ chấm công và sửa hồ sơ ca/lương. */
export function StaffWorktimeCell({ profile, departments, canSetWage }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [badge, setBadge] = useState<StaffQrPayload | null>(null);
  const [loadingBadge, setLoadingBadge] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function openBadge() {
    setLoadingBadge(true);
    const result = await getStaffBadge(profile.staffId);
    setLoadingBadge(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    setBadge(result);
  }

  function printBadge() {
    if (!badge?.dataUrl) return;
    const w = window.open("", "_blank", "width=420,height=620");
    if (!w) return;
    // Tờ in gọn: tên quán, tên nhân viên, mã QR. Cỡ vừa một thẻ nhựa bấm lỗ
    // đeo cổ — thứ nhân viên thực sự cầm tới máy chấm công.
    w.document.write(
      `<html><head><title>Thẻ chấm công ${escapeHtml(badge.name ?? "")}</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;margin:0}
        .store{font-weight:700;font-size:16px;color:#0f172a;margin-bottom:2px}
        .kind{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin-bottom:14px}
        h2{margin:0 0 2px;font-size:20px}
        p{color:#64748b;margin:0 0 16px;font-size:13px}
        img.qr{width:280px;height:280px}
        .foot{margin-top:14px;font-size:11px;color:#94a3b8}
      </style></head>
      <body>
        <div class="store">${escapeHtml(badge.businessName ?? "")}</div>
        <div class="kind">Thẻ chấm công</div>
        <h2>${escapeHtml(badge.name ?? "")}</h2>
        <p>${escapeHtml([badge.employeeNo, badge.departmentName].filter(Boolean).join(" · "))}</p>
        <img class="qr" src="${badge.dataUrl}" alt="QR" />
        <div class="foot">Quét thẻ này ở máy chấm công khi vào ca và khi tan ca.</div>
        <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
      </body></html>`,
    );
    w.document.close();
  }

  async function revoke() {
    const fd = new FormData();
    fd.set("staffId", profile.staffId);
    await revokeStaffBadge(fd);
    toast({ title: "Đã cấp thẻ mới", description: "Thẻ cũ không dùng được nữa. Nhớ in lại." });
    setBadge(null);
    router.refresh();
  }

  async function saveProfile(formData: FormData) {
    formData.set("staffId", profile.staffId);
    setSaving(true);
    const result = await updateStaffWorkProfile({}, formData);
    setSaving(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Không lưu được", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Đã lưu" });
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={openBadge} disabled={loadingBadge}>
          {loadingBadge ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IdCard className="h-4 w-4" />
          )}
          <span className="sr-only">Thẻ chấm công của {profile.name}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          <span className="sr-only">Sửa hồ sơ ca của {profile.name}</span>
        </Button>
      </div>

      <Dialog open={badge !== null} onOpenChange={(open) => !open && setBadge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thẻ chấm công</DialogTitle>
            <DialogDescription>
              In ra và đưa cho nhân viên. Quét thẻ này ở máy chấm công để vào ca và tan ca.
            </DialogDescription>
          </DialogHeader>

          {badge?.dataUrl && (
            <div className="flex flex-col items-center gap-2 py-2">
              <Image
                src={badge.dataUrl}
                alt={`Thẻ chấm công của ${badge.name}`}
                width={240}
                height={240}
                unoptimized
              />
              <p className="font-medium">{badge.name}</p>
              <p className="text-xs text-muted-foreground">
                {[badge.employeeNo, badge.departmentName].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={revoke}>
              <RefreshCw className="h-4 w-4" /> Cấp thẻ mới
            </Button>
            <Button onClick={printBadge}>
              <Printer className="h-4 w-4" /> In thẻ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form action={saveProfile}>
            <DialogHeader>
              <DialogTitle>Hồ sơ ca làm</DialogTitle>
              <DialogDescription>{profile.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {departments.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor={`dept-${profile.staffId}`}>Bộ phận</Label>
                  <select
                    id={`dept-${profile.staffId}`}
                    name="departmentId"
                    defaultValue={profile.departmentId ?? "none"}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">Chưa phân bộ phận</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`no-${profile.staffId}`}>Mã nhân viên</Label>
                  <Input
                    id={`no-${profile.staffId}`}
                    name="employeeNo"
                    defaultValue={profile.employeeNo ?? ""}
                    placeholder="NV01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`phone-${profile.staffId}`}>Điện thoại</Label>
                  <Input
                    id={`phone-${profile.staffId}`}
                    name="phone"
                    defaultValue={profile.phone ?? ""}
                    placeholder="+49…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`wh-${profile.staffId}`}>Giờ/tuần</Label>
                  <Input
                    id={`wh-${profile.staffId}`}
                    name="weeklyHours"
                    defaultValue={profile.weeklyHours ?? ""}
                    placeholder="40"
                  />
                </div>
                {canSetWage && (
                  <div className="space-y-2">
                    <Label htmlFor={`wage-${profile.staffId}`}>Lương giờ (€)</Label>
                    <Input
                      id={`wage-${profile.staffId}`}
                      name="hourlyWage"
                      defaultValue={
                        profile.hourlyWageCents == null
                          ? ""
                          : (profile.hourlyWageCents / 100).toFixed(2)
                      }
                      placeholder="13,50"
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Nội dung đi thẳng vào `document.write` nên phải chặn HTML lọt vào. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
