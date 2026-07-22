"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { requestPasswordReset, type ResetRequestState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Gửi liên kết đặt lại
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sent) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-foreground">
          Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật
          khẩu. Vui lòng kiểm tra hộp thư (kể cả mục Spam). Liên kết hết hạn sau 1 giờ.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="ban@vidu.de" required />
        {state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
