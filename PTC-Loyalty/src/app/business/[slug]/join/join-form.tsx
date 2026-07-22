"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { joinBusiness, type JoinState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Đăng ký thành viên
    </Button>
  );
}

export function JoinForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState<JoinState, FormData>(joinBusiness, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">Tên *</Label>
          <Input id="firstName" name="firstName" required />
          {state.fieldErrors?.firstName && (
            <p className="text-xs text-destructive">{state.fieldErrors.firstName[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Họ</Label>
          <Input id="lastName" name="lastName" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" name="email" type="email" required />
        {state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Số điện thoại</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+49 ..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu *</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        {state.fieldErrors?.password && (
          <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="marketingConsent" className="h-4 w-4" />
        Đồng ý nhận ưu đãi qua email
      </label>
      <SubmitButton />
    </form>
  );
}
