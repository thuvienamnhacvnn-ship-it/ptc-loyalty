"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { deleteStaff, offboardStaff, type RemoveStaffResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  staffId: string;
  name: string;
  /** Số liệu để người bấm biết mình sắp mất gì nếu xoá hẳn. */
  timeEntryCount: number;
}

type Mode = "offboard" | "delete";

/**
 * Nghỉ việc và xoá vĩnh viễn.
 *
 * Cố ý đặt "cho nghỉ việc" làm mặc định và để "xoá vĩnh viễn" sau một lần bấm
 * nữa: giờ công là chứng từ trả lương, xoá nhầm thì không dựng lại được. Cả hai
 * đều đòi nhập mật khẩu của chính người đang thao tác, vì máy trong quán thường
 * để đăng nhập sẵn suốt ngày.
 */
export function RemoveStaffDialog({ staffId, name, timeEntryCount }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("offboard");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password) {
      toast({ variant: "destructive", title: "Nhập mật khẩu của bạn để xác nhận." });
      return;
    }
    setBusy(true);
    const result: RemoveStaffResult =
      mode === "delete"
        ? await deleteStaff(staffId, password)
        : await offboardStaff(staffId, password);
    setBusy(false);

    if (!result.ok) {
      toast({ variant: "destructive", title: "Không thực hiện được", description: result.error });
      return;
    }
    toast({ variant: "success", title: "Xong", description: result.summary });
    setOpen(false);
    setPassword("");
    setMode("offboard");
    router.refresh();
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive"
      >
        <UserMinus className="h-4 w-4" />
        <span className="sr-only">Cho {name} nghỉ việc</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setPassword("");
            setMode("offboard");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "delete" ? "Xoá vĩnh viễn nhân viên" : "Cho nghỉ việc"}
            </DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mode === "offboard" ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Sẽ xảy ra:</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  <li>• Thu hồi thẻ chấm công — thẻ đã in hết dùng được ngay.</li>
                  <li>• Gỡ mọi ca đã xếp từ ngày mai trở đi.</li>
                  <li>• Ngừng hoạt động, không quét chấm công được nữa.</li>
                  <li className="text-foreground">
                    • <strong>Giữ nguyên</strong> {timeEntryCount} lần chấm công đã có, để còn tính
                    lương tháng cuối.
                  </li>
                </ul>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Không thể hoàn tác.</p>
                  <p className="mt-1">
                    Xoá cả hồ sơ lẫn <strong>{timeEntryCount} lần chấm công</strong> của người này.
                    Bảng công những tháng đã qua sẽ đổi số. Chỉ làm khi nhập nhầm người.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`pw-${staffId}`}>Mật khẩu của bạn *</Label>
              <PasswordInput
                id={`pw-${staffId}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Nhập để xác nhận"
              />
            </div>

            <button
              type="button"
              onClick={() => setMode(mode === "delete" ? "offboard" : "delete")}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {mode === "delete"
                ? "← Quay lại: chỉ cho nghỉ việc, giữ lịch sử"
                : "Cần xoá sạch cả lịch sử chấm công?"}
            </button>
          </div>

          <DialogFooter>
            <Button
              onClick={submit}
              disabled={busy || !password}
              variant={mode === "delete" ? "destructive" : "default"}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "delete" ? "Xoá vĩnh viễn" : "Cho nghỉ việc"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
