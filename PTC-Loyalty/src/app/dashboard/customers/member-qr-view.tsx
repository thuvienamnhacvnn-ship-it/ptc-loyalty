"use client";

import { Download, Printer, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { toWhatsAppNumber } from "@/lib/phone";

// Inlined at build time → the production origin (https://ptc-loyalty.com),
// never localhost in a production build, so shared links are always public.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

/**
 * Renders a member QR (PNG data URL) with three MANUAL actions — download,
 * print, and "Gửi qua WhatsApp". The WhatsApp action does NOT use the Cloud API.
 *
 * It opens a chat PRE-ADDRESSED to the customer's own registered number (so the
 * owner never has to search contacts) and reuses the owner's existing WhatsApp
 * session (so there's no re-login):
 *  - mobile  → wa.me opens the WhatsApp app straight to the customer's chat;
 *  - desktop → web.whatsapp.com/send opens WhatsApp Web straight to that chat
 *    (skipping the api.whatsapp.com "Continue to chat" interstitial), using the
 *    tab the owner is already logged into.
 * The message carries a public link to the customer's QR card. The owner just
 * presses Send.
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

  const hasQr = !!dataUrl;
  const shareMessage =
    `Xin chào ${name}, đây là mã QR thành viên của bạn tại ${storeName}. ` +
    `Vui lòng lưu mã này để tích điểm trong những lần tiếp theo.`;
  // Public, production URL to the customer's QR card (sent in the message).
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

  function sendWhatsApp() {
    const num = toWhatsAppNumber(phone);
    if (!num) {
      toast({ variant: "destructive", title: "Số điện thoại WhatsApp không hợp lệ." });
      return;
    }
    const text = publicUrl ? `${shareMessage}\n${publicUrl}` : shareMessage;
    const encoded = encodeURIComponent(text);
    const isMobile =
      typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    // Both open a chat pre-addressed to the customer's number and reuse the
    // owner's existing WhatsApp login. wa.me on mobile jumps into the app chat;
    // web.whatsapp.com/send on desktop goes straight to the WhatsApp Web chat.
    const url = isMobile
      ? `https://wa.me/${num}?text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${num}&text=${encoded}`;
    window.open(url, "_blank", "noopener");
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
          disabled={!hasQr || !phone}
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
