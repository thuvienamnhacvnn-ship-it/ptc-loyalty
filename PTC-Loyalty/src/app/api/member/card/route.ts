import QRCode from "qrcode";
import type { NextRequest } from "next/server";
import { verifyQrToken } from "@/lib/qr";

// GET /api/member/card?token=<signed member token> → PNG of the member QR.
// Public + signed: only a validly-signed token renders. Used as the image link
// in the WhatsApp membership-card message (WhatsApp fetches this URL server-side).
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const v = verifyQrToken(token);
  if (!v.ok) {
    return new Response("Invalid token", { status: 400 });
  }

  const png = await QRCode.toBuffer(token, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
