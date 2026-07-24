"use client";

import { Download, Printer, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { toWhatsAppNumber } from "@/lib/phone";

/**
 * Renders a member QR (PNG data URL) with three MANUAL actions — download,
 * print, and "Gửi qua WhatsApp". The WhatsApp action does NOT use the Cloud API.
 *
 * To actually send the QR IMAGE (not a link), it uses the Web Share API to
 * share the PNG — the only way to put the image itself into a WhatsApp chat
 * without the Cloud API (wa.me links can carry text only). On mobile the native
 * share sheet lets the owner pick WhatsApp → the customer. On desktop, where
 * file-share to WhatsApp isn't available, it downloads the QR and opens the
 * customer's chat so the owner attaches the just-downloaded image.
 *
 * `token` is accepted for compatibility with callers but is no longer used here
 * (the flow sends the image, not the /card/<token> link).
 */
export function MemberQrView({
  dataUrl,
  name,
  memberCode,
  customerId,
  phone,
  storeName,
  logoUrl,
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

  function downloadQr() {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `customer-${customerId}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function sendWhatsApp() {
    // Primary: share the ACTUAL QR image. This is the only way to put the image
    // itself into a WhatsApp chat without the Cloud API — WhatsApp's click-to-
    // chat links (wa.me) can carry text only, never an attachment. On mobile the
    // native share sheet lets the owner pick WhatsApp → the customer.
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
      // Owner dismissed the native share sheet → stop.
      if (e instanceof DOMException && e.name === "AbortError") return;
    }

    // Desktop fallback: file-share to WhatsApp isn't available, so download the
    // QR image and open the customer's chat — the owner drags/attaches the
    // just-downloaded image and presses Send.
    downloadQr();
    const num = toWhatsAppNumber(phone);
    if (num) {
      window.open(
        `https://web.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(shareMessage)}`,
        "_blank",
        "noopener",
      );
    }
    toast({
      title: "Đã tải ảnh QR về máy",
      description: "Kéo (đính kèm) ảnh QR vừa tải vào khung chat WhatsApp rồi bấm gửi.",
    });
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
