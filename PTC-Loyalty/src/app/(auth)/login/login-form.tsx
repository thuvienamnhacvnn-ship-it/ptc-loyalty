"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { login, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Đăng nhập
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(login, {});

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
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="ban@vidu.de"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mật khẩu</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
