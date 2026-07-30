"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MoreHorizontal,
  KeyRound,
  Lock,
  Unlock,
  Pencil,
  ShieldCheck,
  Copy,
} from "lucide-react";
import {
  setUserActive,
  setUserRole,
  resetUserPassword,
  updateUserInfo,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { UserRole } from "@prisma/client";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  BUSINESS_OWNER: "Chủ doanh nghiệp",
  BUSINESS_MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  CUSTOMER: "Khách hàng",
};

interface Props {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    locale: string;
    isActive: boolean;
  };
  /** True for the signed-in admin — self-destructive actions are hidden. */
  isSelf: boolean;
}

export function UserActions({ user, isSelf }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return false;
    }
    toast({ variant: "success", title: done });
    router.refresh();
    return true;
  }

  async function onReset() {
    if (
      !confirm(
        `Đặt lại mật khẩu cho ${user.email}? Mật khẩu cũ và mọi link đặt lại đang chờ sẽ mất hiệu lực.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await resetUserPassword(user.id);
    setBusy(false);
    if (!result.ok || !result.password) {
      toast({ variant: "destructive", title: "Lỗi", description: result.error });
      return;
    }
    setTempPassword(result.password);
    router.refresh();
  }

  async function onEdit(formData: FormData) {
    const ok = await run(
      () =>
        updateUserInfo(user.id, {
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          locale: formData.get("locale") as "vi" | "de" | "en",
        }),
      "Đã cập nhật tài khoản",
    );
    if (ok) setEditOpen(false);
  }

  async function onRole(formData: FormData) {
    const ok = await run(
      () => setUserRole(user.id, formData.get("role") as UserRole),
      "Đã đổi vai trò",
    );
    if (ok) setRoleOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={busy} aria-label="Tác vụ">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Sửa thông tin
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReset}>
            <KeyRound className="h-4 w-4" /> Đặt lại mật khẩu
          </DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem onClick={() => setRoleOpen(true)}>
              <ShieldCheck className="h-4 w-4" /> Đổi vai trò
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              {user.isActive ? (
                <DropdownMenuItem
                  onClick={() =>
                    run(() => setUserActive(user.id, false), "Đã khóa tài khoản")
                  }
                >
                  <Lock className="h-4 w-4" /> Khóa tài khoản
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    run(() => setUserActive(user.id, true), "Đã mở khóa tài khoản")
                  }
                >
                  <Unlock className="h-4 w-4" /> Mở khóa
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit info */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa tài khoản</DialogTitle>
            <DialogDescription>
              Đổi email sẽ đổi luôn tên đăng nhập của người dùng.
            </DialogDescription>
          </DialogHeader>
          <form action={onEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${user.id}`}>Họ tên *</Label>
              <Input
                id={`name-${user.id}`}
                name="name"
                defaultValue={user.name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${user.id}`}>Email *</Label>
              <Input
                id={`email-${user.id}`}
                name="email"
                type="email"
                defaultValue={user.email}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`locale-${user.id}`}>Ngôn ngữ</Label>
              <select
                id={`locale-${user.id}`}
                name="locale"
                defaultValue={user.locale}
                className={selectClass}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change role */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi vai trò</DialogTitle>
            <DialogDescription>
              Vai trò quyết định trang người dùng vào sau khi đăng nhập. Quyền
              trong từng doanh nghiệp vẫn do StaffProfile quy định.
            </DialogDescription>
          </DialogHeader>
          <form action={onRole} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`role-${user.id}`}>Vai trò</Label>
              <select
                id={`role-${user.id}`}
                name="role"
                defaultValue={user.role}
                className={selectClass}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Đổi vai trò
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temp password — shown once */}
      <Dialog
        open={tempPassword !== null}
        onOpenChange={(open) => !open && setTempPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mật khẩu tạm</DialogTitle>
            <DialogDescription>
              Chỉ hiện một lần. Gửi cho {user.email} và yêu cầu đổi ngay sau khi
              đăng nhập.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              {tempPassword}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (tempPassword) {
                  navigator.clipboard.writeText(tempPassword);
                  toast({ title: "Đã copy" });
                }
              }}
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
