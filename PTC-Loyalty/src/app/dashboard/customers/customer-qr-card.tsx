"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { customerQrDataUrl, type CustomerQrResult } from "./actions";
import { MemberQrView } from "./member-qr-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Fetches + displays a customer's fixed membership QR (for the detail page). */
export function CustomerQrCard({ customerId }: { customerId: string }) {
  const [state, setState] = useState<CustomerQrResult | null>(null);

  useEffect(() => {
    let alive = true;
    customerQrDataUrl(customerId).then((r) => alive && setState(r));
    return () => {
      alive = false;
    };
  }, [customerId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mã QR thành viên</CardTitle>
      </CardHeader>
      <CardContent>
        {!state ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : state.ok ? (
          <MemberQrView dataUrl={state.dataUrl} name={state.name} memberCode={state.memberCode} />
        ) : (
          <p className="py-6 text-center text-sm text-destructive">{state.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
