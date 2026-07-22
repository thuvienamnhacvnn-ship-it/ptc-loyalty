"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { resetPassword, type ResetPasswordState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Đặt mật khẩu mới
    </Button>
  );
}

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    {},
  );
  const [clientError, setClientError] = useState<string | null>(null);

  if (state.done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-foreground">
            Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới trên cả
            Web và App Desktop.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Đăng nhập</Link>
        </Button>
      </div>
    );
  }

  // Missing/invalid link params — can't reset.
  if (!token || !email) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Liên kết không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu mới.
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
        </Button>
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    if (password.length < 8) {
      setClientError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setClientError("Xác nhận mật khẩu không khớp.");
      return;
    }
    setClientError(null);
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      {(clientError || state.error) && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {clientError ?? state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu mới</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
          required
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}
