"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import { quickJoin, type QuickJoinState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full text-base" disabled={pending}>
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
      {pending ? "Đang gửi thẻ..." : "Nhận thẻ thành viên"}
    </Button>
  );
}

export function QuickJoinForm({ slug, storeName }: { slug: string; storeName: string }) {
  const [state, formAction] = useActionState<QuickJoinState, FormData>(quickJoin, {});

  // Done — show the card on screen too, so the customer has it even if the
  // WhatsApp message is delayed or the restaurant hasn't paired its number yet.
  if (state.member) {
    const m = state.member;
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 text-success">
          <CheckCircle2 className="h-6 w-6" />
          <p className="text-lg font-semibold">Chào mừng {m.name}!</p>
        </div>

        <div className="mx-auto w-fit rounded-lg border bg-white p-3">
          <Image
            src={m.qrDataUrl}
            alt="Mã QR thành viên"
            width={240}
            height={240}
            unoptimized
            className="h-60 w-60"
          />
        </div>

        <p className="text-sm">
          Mã thành viên: <span className="font-mono font-semibold">{m.memberCode}</span>
        </p>
        {m.bonusPoints > 0 && (
          <p className="text-sm text-muted-foreground">
            Bạn được tặng ngay <b>{m.bonusPoints} điểm</b>.
          </p>
        )}

        <div className="rounded-md bg-muted/50 p-3 text-left text-sm">
          {m.whatsapp === "sent" ? (
            <p className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>
                {storeName} vừa gửi thẻ QR này qua WhatsApp cho bạn. Mở WhatsApp và
                lưu ảnh lại nhé.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                Hãy <b>chụp màn hình</b> mã QR này để dùng cho lần ghé sau — bạn cũng có
                thể đưa mã thành viên cho nhân viên.
              </span>
            </p>
          )}
        </div>

        <div className="space-y-1 text-left text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Cách tích điểm:</p>
          <p>1. Mỗi lần đến {storeName}, mở mã QR này.</p>
          <p>2. Đưa cho nhân viên quét.</p>
          <p>3. Điểm được cộng ngay, đủ điểm là đổi quà.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-2">
        <Label htmlFor="firstName">Tên của bạn</Label>
        <Input
          id="firstName"
          name="firstName"
          required
          autoComplete="given-name"
          placeholder="Nguyễn An"
          className="h-12 text-base"
        />
        {state.fieldErrors?.firstName && (
          <p className="text-sm text-destructive">{state.fieldErrors.firstName[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Số WhatsApp</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="0151 2345678"
          className="h-12 text-base"
        />
        {state.fieldErrors?.phone && (
          <p className="text-sm text-destructive">{state.fieldErrors.phone[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Thẻ QR thành viên sẽ được gửi tới số này qua WhatsApp.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0" />
        <span className="text-muted-foreground">
          Tôi đồng ý nhận thẻ thành viên và thông báo điểm thưởng từ {storeName} qua
          WhatsApp. Có thể hủy bất cứ lúc nào.
        </span>
      </label>
      {state.fieldErrors?.consent && (
        <p className="text-sm text-destructive">{state.fieldErrors.consent[0]}</p>
      )}

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
