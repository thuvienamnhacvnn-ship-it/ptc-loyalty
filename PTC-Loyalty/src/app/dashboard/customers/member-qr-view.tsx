"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Renders a member QR (PNG data URL) with download + print actions. */
export function MemberQrView({
  dataUrl,
  name,
  memberCode,
}: {
  dataUrl: string;
  name: string;
  memberCode: string;
}) {
  function printQr() {
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(
      `<html><head><title>Thẻ thành viên ${memberCode}</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:32px;margin:0}
        h2{margin:0 0 4px;font-size:20px}
        p{color:#64748b;margin:0 0 20px;font-size:14px}
        img{width:300px;height:300px}
      </style></head>
      <body>
        <h2>${name}</h2>
        <p>${memberCode}</p>
        <img src="${dataUrl}" alt="QR" />
        <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
      </body></html>`,
    );
    w.document.close();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL, next/image adds nothing */}
      <img
        src={dataUrl}
        alt={`QR thành viên ${memberCode}`}
        className="h-48 w-48 rounded-xl border bg-white p-2 shadow-sm"
      />
      <div className="text-center">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted-foreground">{memberCode}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={dataUrl} download={`qr-${memberCode}.png`}>
            <Download className="h-4 w-4" /> Tải về
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={printQr}>
          <Printer className="h-4 w-4" /> In thẻ
        </Button>
      </div>
    </div>
  );
}
