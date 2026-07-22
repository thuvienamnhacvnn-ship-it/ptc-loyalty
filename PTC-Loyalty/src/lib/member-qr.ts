import QRCode from "qrcode";
import { createStaticQrToken } from "@/lib/qr";

export interface MemberQrData {
  businessId: string;
  customerId: string;
  memberCode: string;
  secret: string; // customer.qrSecret
}

export interface MemberQrResult {
  token: string;
  dataUrl: string; // PNG data URI, ready for <img src>, download, or print
}

/**
 * Render a customer's FIXED membership QR as a signed token + PNG data URL.
 * Used by the dashboard (staff view/print) and the desktop create-customer flow.
 */
export async function renderMemberQrPng(data: MemberQrData): Promise<MemberQrResult> {
  const token = createStaticQrToken(data);
  const dataUrl = await QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
  });
  return { token, dataUrl };
}
