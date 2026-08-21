"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Printer, UserPlus } from "lucide-react";
import { addStaff, type AddStaffResult } from "./actions";
import { printBadgeSheet } from "./badge-print";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  businessName: string;
  canAddManager: boolean;
}

/** Thông tin cần để in tờ thẻ ngay sau khi nhận việc. */
interface IssuedBadge {
  name: string;
  employeeNo: string;
  dataUrl: string;
  whatsappSent: boolean;
  whatsappNote?: string;
}

/**
 * Nhận việc là MỘT luồng liền mạch, không phải hai việc rời:
 * nhập thông tin → tài khoản được tạo → thẻ chấm công được cấp và bắn thẳng về
 * WhatsApp của nhân viên → màn hình hiện luôn tấm thẻ để in nếu quán muốn.
 *
 * Vì vậy số điện thoại là BẮT BUỘC: nó là đường giao thẻ.
 */
export function AddStaffDialog({ branches, departments, businessName, canAddManager }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedBadge | null>(null);
  const [role, setRole] = useState<"STAFF" | "BUSINESS_MANAGER">("STAFF");
  const needsLogin = role === "BUSINESS_MANAGER";

  async function onSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "");
    const employeeNo = String(formData.get("employeeNo") ?? "");
    setBusy(true);
    const result: AddStaffResult = await addStaff({
      name,
      phone: String(formData.get("phone") ?? ""),
      role,
      // Chỉ quản lý mới có tài khoản; nhân viên thường không gửi hai trường này.
      email: needsLogin ? String(formData.get("email") ?? "") : undefined,
      password: needsLogin ? String(formData.get("password") ?? "") : undefined,
      branchId: String(formData.get("branchId") ?? "") || undefined,
      departmentId: String(formData.get("departmentId") ?? "") || undefined,
      employeeNo: employeeNo || undefined,
      maxPointsGrant: formData.get("maxPointsGrant")
        ? Number(formData.get("maxPointsGrant"))
        : undefined,
    });
    setBusy(false);

    if (!result.ok) {
      toast({ variant: "destructive", title: "Không thêm được", description: result.error });
      return;
    }

    router.refresh();
    if (result.badgeDataUrl) {
      // Chuyển hộp thoại sang bước "đã cấp thẻ" thay vì đóng lại: quản lý cần
      // thấy thẻ đã tới tay nhân viên chưa, và in ngay nếu WhatsApp không tới.
      setIssued({
        name,
        employeeNo,
        dataUrl: result.badgeDataUrl,
        whatsappSent: !!result.whatsappSent,
        whatsappNote: result.whatsappNote,
      });
    } else {
      toast({ variant: "success", title: "Đã thêm nhân viên" });
      setOpen(false);
    }
  }

  function close() {
    setOpen(false);
    setIssued(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setIssued(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" /> Thêm nhân viên
        </Button>
      </DialogTrigger>

      <DialogContent>
        {issued ? (
          <>
            <DialogHeader>
              <DialogTitle>Đã nhận việc — thẻ chấm công đã cấp</DialogTitle>
              <DialogDescription>{issued.name}</DialogDescription>
            </DialogHeader>

            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                issued.whatsappSent
                  ? "bg-success/10 text-success"
                  : "bg-warning/15 text-warning"
              }`}
            >
              {issued.whatsappSent ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>
                {issued.whatsappSent
                  ? "Đã gửi thẻ về WhatsApp của nhân viên kèm hướng dẫn sử dụng."
                  : issued.whatsappNote}
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 py-2">
              <Image
                src={issued.dataUrl}
                alt={`Thẻ chấm công của ${issued.name}`}
                width={220}
                height={220}
                unoptimized
              />
              <p className="text-xs text-muted-foreground">
                {issued.employeeNo || "Chưa đặt mã nhân viên"}
              </p>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                onClick={() =>
                  printBadgeSheet({
                    businessName,
                    name: issued.name,
                    subtitle: issued.employeeNo,
                    dataUrl: issued.dataUrl,
                  })
                }
              >
                <Printer className="h-4 w-4" /> In thẻ
              </Button>
              <Button onClick={close}>Xong</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Thêm nhân viên</DialogTitle>
              <DialogDescription>
                Nhân viên KHÔNG đăng nhập — thẻ chấm công và mọi thông báo đi qua WhatsApp theo số
                điện thoại bên dưới. Chỉ quản lý mới cần email và mật khẩu.
              </DialogDescription>
            </DialogHeader>

            <form action={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Họ tên *</Label>
                <Input id="name" name="name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại (WhatsApp) *</Label>
                <Input id="phone" name="phone" type="tel" placeholder="0152 3456789" required />
                <p className="text-xs text-muted-foreground">
                  Thẻ chấm công, xác nhận nghỉ và bảng công cuối tháng đều gửi về số này.
                </p>
              </div>

              {needsLogin && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email đăng nhập *</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mật khẩu tạm *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="text"
                      placeholder="Tối thiểu 8 ký tự"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="role">Vai trò</Label>
                  <select
                    id="role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "STAFF" | "BUSINESS_MANAGER")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="STAFF">Nhân viên</option>
                    {canAddManager && <option value="BUSINESS_MANAGER">Quản lý</option>}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchId">Chi nhánh</Label>
                  <select
                    id="branchId"
                    name="branchId"
                    defaultValue=""
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Tất cả</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {departments.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="departmentId">Bộ phận</Label>
                    <select
                      id="departmentId"
                      name="departmentId"
                      defaultValue=""
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Chưa phân</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="employeeNo">Mã nhân viên</Label>
                  <Input id="employeeNo" name="employeeNo" placeholder="NV01" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPointsGrant">Giới hạn điểm cấp / giao dịch</Label>
                <Input
                  id="maxPointsGrant"
                  name="maxPointsGrant"
                  type="number"
                  placeholder="Không giới hạn"
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Thêm và cấp thẻ
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
