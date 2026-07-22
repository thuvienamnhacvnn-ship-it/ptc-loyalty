import QRCode from "qrcode";
import { getCustomerContext } from "@/lib/tenant";
import { createQrToken } from "@/lib/qr";

const TTL_SECONDS = 60;

/** Returns a fresh, short-lived signed QR token + rendered PNG for the
 *  logged-in customer. Called on an interval by the member card (dynamic QR). */
export async function GET() {
  const { profile } = await getCustomerContext();
  if (!profile) {
    return Response.json({ error: "not_a_member" }, { status: 403 });
  }

  const token = createQrToken(
    {
      businessId: profile.businessId,
      customerId: profile.id,
      memberCode: profile.memberCode,
      secret: profile.qrSecret,
    },
    TTL_SECONDS,
  );

  const dataUrl = await QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  return Response.json(
    { token, dataUrl, expiresIn: TTL_SECONDS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
