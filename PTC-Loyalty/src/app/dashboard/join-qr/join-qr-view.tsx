"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  storeName: string;
  joinUrl: string;
  qrDataUrl: string;
  whatsappConnected: boolean;
  senderNumber: string | null;
}

export function JoinQrView(props: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(props.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const a = document.createElement("a");
    a.href = props.qrDataUrl;
    a.download = `qr-dang-ky-${props.storeName.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* The printable card. `print:` classes strip the dashboard chrome. */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-4 p-6 text-center print:p-0">
          <div id="join-qr-print" className="space-y-3">
            <p className="text-lg font-bold">{props.storeName}</p>
            <p className="text-sm text-muted-foreground">
              Quét mã để nhận thẻ thành viên
            </p>
            <div className="mx-auto w-fit rounded-lg bg-white p-3">
              <Image
                src={props.qrDataUrl}
                alt="QR đăng ký thành viên"
                width={280}
                height={280}
                unoptimized
                className="h-72 w-72"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tích điểm mỗi lần ghé · Đổi quà miễn phí
            </p>
          </div>

          <div className="flex justify-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> In
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              <Download className="h-4 w-4" /> Tải PNG
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Đã chép" : "Chép link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 print:hidden">
        {!props.whatsappConnected && (
          <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Chưa kết nối WhatsApp</p>
              <p className="text-muted-foreground">
                Khách vẫn đăng ký được và thấy mã QR trên màn hình, nhưng chưa nhận
                được tin nhắn. Hãy{" "}
                <Link href="/dashboard/settings/whatsapp" className="font-medium underline">
                  quét mã đăng nhập WhatsApp
                </Link>{" "}
                để gửi thẻ tự động từ số của quán.
              </p>
            </div>
          </div>
        )}

        {props.whatsappConnected && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Sẵn sàng gửi tự động</p>
            <p className="text-muted-foreground">
              Khách đăng ký xong sẽ nhận tin nhắn từ số{" "}
              <span className="font-mono">
                {props.senderNumber ? `+${props.senderNumber}` : "của quán"}
              </span>
              : lời chào, ảnh QR thành viên và hướng dẫn tích điểm.
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Khách sẽ trải qua</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Quét mã QR trên bàn bằng camera điện thoại.</p>
            <p>2. Nhập tên và số WhatsApp (10 giây, không cần mật khẩu).</p>
            <p>3. Nhận ngay tin nhắn WhatsApp từ {props.storeName} kèm ảnh QR thành viên.</p>
            <p>4. Lần sau đến quán chỉ cần đưa QR đó cho nhân viên quét.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link đăng ký</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">
              {props.joinUrl}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Dùng được cả trên Facebook, Google Maps hay tin nhắn — không nhất thiết
              phải quét QR.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
