import type { Metadata } from "next";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireBusinessContext } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/page-header";
import { JoinQrView } from "./join-qr-view";

export const metadata: Metadata = { title: "QR đăng ký khách" };

/**
 * The QR the restaurant prints and puts on the table/counter. A customer scans
 * it, types name + phone, and immediately receives their membership QR on
 * WhatsApp from the restaurant's own number.
 */
export default async function JoinQrPage() {
  const ctx = await requireBusinessContext();

  const [business, connection] = await Promise.all([
    db.business.findUnique({
      where: { id: ctx.businessId },
      select: { name: true, slug: true },
    }),
    db.whatsAppConnection.findUnique({
      where: { businessId: ctx.businessId },
      select: { status: true, displayPhoneNumber: true },
    }),
  ]);
  if (!business) return null;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const joinUrl = `${appUrl}/j/${business.slug}`;

  // High error correction: printed QRs get smudged, taped over and photographed
  // at an angle.
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 720,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR đăng ký khách"
        description="In mã này và đặt trên bàn hoặc quầy. Khách quét, nhập tên và số WhatsApp, rồi nhận ngay thẻ thành viên."
      />
      <JoinQrView
        storeName={business.name}
        joinUrl={joinUrl}
        qrDataUrl={qrDataUrl}
        whatsappConnected={connection?.status === "CONNECTED"}
        senderNumber={connection?.displayPhoneNumber ?? null}
      />
    </div>
  );
}
