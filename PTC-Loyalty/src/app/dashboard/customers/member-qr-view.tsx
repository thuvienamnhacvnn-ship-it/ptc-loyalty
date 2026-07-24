"use client";

import { useState } from "react";
import { Download, Printer, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { toWhatsAppNumber } from "@/lib/phone";

// Inlined at build time → the production origin (https://ptc-loyalty.com),
// never localhost in a production build, so shared links are always public.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

/**
 * Renders a member QR (PNG data URL) with three MANUAL actions — download,
 * print, and "Gửi qua WhatsApp". The WhatsApp action does NOT use the Cloud API:
 *  - on mobile it uses the Web Share API to share the QR PNG (owner picks
 *    WhatsApp in the native share sheet);
 *  - on desktop / when file-share is unavailable it opens wa.me with a public
 *    link to the customer's QR card, pre-filling the message (owner presses Send).
 */
export function MemberQrView({
  dataUrl,
  name,
  memberCode,
  customerId,
  phone,
  storeName,
  logoUrl,
  token,
}: {
  dataUrl: string;
  name: string;
  memberCode: string;
  customerId: string;
  phone: string | null;
  storeName: string;
  logoUrl: string | null;
  token: string;
}) {
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);

  const hasQr = !!dataUrl;
  const shareMessage =
    `Xin chào ${name}, đây là mã QR thành viên của bạn tại ${storeName}. ` +
    `Vui lòng lưu mã này để tích điểm trong những lần tiếp theo.`;
  // Public, production URL to the customer's QR card (used in the wa.me message).
  const publicUrl = APP_URL ? `${APP_URL}/card/${token}` : "";

  function printQr() {
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    const header = logoUrl
      ? `<img class="logo" src="${logoUrl}" alt="${storeName}" />`
      : `<div class="store">${storeName}</div>`;
    // A compact print sheet: logo (or store name) + customer name + QR + code.
    // Deliberately NOT the whole dashboard.
    w.document.write(
      `<html><head><title>Thẻ thành viên ${memberCode}</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:28px;margin:0}
        .logo{max-height:56px;max-width:220px;object-fit:contain;margin-bottom:12px}
        .store{font-weight:700;font-size:18px;margin-bottom:12px}
        h2{margin:0 0 4px;font-size:20px}
        p{color:#64748b;margin:0 0 18px;font-size:14px}
        img.qr{width:300px;height:300px}
      </style></head>
      <body>
        ${header}
        <h2>${name}</h2>
        <p>${memberCode}</p>
        <img class="qr" src="${dataUrl}" alt="QR" />
        <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
      </body></html>`,
    );
    w.document.close();
  }

  async function sendWhatsApp() {
    if (sharing) return;
    setSharing(true);
    try {
      // 1) Mobile: Web Share API — share the actual QR PNG so the shop owner can
      //    pick WhatsApp in the native share sheet. No Cloud API involved.
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `customer-${customerId}-qr.png`, { type: "image/png" });
        const nav = navigator as Navigator & {
          canShare?: (data?: { files?: File[] }) => boolean;
        };
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareMessage, title: "Thẻ thành viên" });
          return;
        }
      } catch (e) {
        // Owner dismissed the native share sheet → stop (don't also open wa.me).
        if (e instanceof DOMException && e.name === "AbortError") return;
      }

      // 2) Desktop / no file-share: open wa.me with the public QR link so the
      //    owner confirms and presses Send manually.
      const num = toWhatsAppNumber(phone);
      if (!num) {
        toast({ variant: "destructive", title: "Số điện thoại WhatsApp không hợp lệ." });
        return;
      }
      const text = publicUrl ? `${shareMessage}\n${publicUrl}` : shareMessage;
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } finally {
      setSharing(false);
    }
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

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button variant="outline" size="sm" asChild disabled={!hasQr}>
          <a href={dataUrl} download={`customer-${customerId}-qr.png`}>
            <Download className="h-4 w-4" /> Tải QR
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={printQr} disabled={!hasQr}>
          <Printer className="h-4 w-4" /> In QR
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={sendWhatsApp}
          disabled={!hasQr || !phone || sharing}
          className="text-success"
        >
          <MessageCircle className="h-4 w-4" /> Gửi qua WhatsApp
        </Button>
      </div>

      {!phone && (
        <p className="text-center text-xs text-muted-foreground">
          Khách hàng chưa có số điện thoại.
        </p>
      )}
    </div>
  );
}
