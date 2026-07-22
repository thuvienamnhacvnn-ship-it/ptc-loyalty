"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { registerBusiness, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const businessTypes = [
  { value: "restaurant", label: "Nhà hàng" },
  { value: "cafe", label: "Quán café" },
  { value: "nail_salon", label: "Nail salon" },
  { value: "beauty_salon", label: "Beauty salon" },
  { value: "retail", label: "Cửa hàng bán lẻ" },
  { value: "supermarket", label: "Siêu thị" },
  { value: "service", label: "Trung tâm dịch vụ" },
  { value: "other", label: "Khác" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Tạo tài khoản & dùng thử 14 ngày
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    registerBusiness,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="businessName">Tên doanh nghiệp</Label>
        <Input
          id="businessName"
          name="businessName"
          placeholder="Phở Hà Nội Berlin"
          required
        />
        {state.fieldErrors?.businessName && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.businessName[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessType">Loại hình kinh doanh</Label>
        <select
          id="businessType"
          name="businessType"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Chọn loại hình
          </option>
          {businessTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerName">Họ tên của bạn</Label>
        <Input id="ownerName" name="ownerName" placeholder="Nguyễn Văn A" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="ban@vidu.de" required />
        {state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
          required
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <SubmitButton />
      <p className="text-center text-xs text-muted-foreground">
        Bằng việc đăng ký, bạn đồng ý với Điều khoản và Chính sách bảo mật.
      </p>
    </form>
  );
}
