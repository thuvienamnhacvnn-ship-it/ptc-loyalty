import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/qr";

// Public, standalone membership-card page (NOT under the authed /member portal).
// The manual "Gửi qua WhatsApp" flow links here (https://ptc-loyalty.com/card/<token>).
// The token is HMAC-signed, so only a valid token renders — the raw customer id
// is never guessable. No login required.
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Thẻ thành viên",
  robots: { index: false, follow: false }, // don't index personal cards
};

export default async function MemberCardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);

  const v = verifyQrToken(decoded);
  if (!v.ok) notFound();
  const { b: businessId, c: customerId, m: memberCode } = v.payload;

  const [business, customer] = await Promise.all([
    db.business.findUnique({
      where: { id: businessId },
      select: { name: true, branding: { select: { logoUrl: true } } },
    }),
    db.customerProfile.findFirst({
      where: { id: customerId, businessId },
      select: { firstName: true, lastName: true, memberCode: true },
    }),
  ]);
  // Defence: customer must exist in that business and the member code must match.
  if (!business || !customer || customer.memberCode !== memberCode) notFound();

  const name = `${customer.firstName} ${customer.lastName ?? ""}`.trim();
  const qrSrc = `/api/member/card?token=${encodeURIComponent(decoded)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 text-center shadow-sm">
        {business.branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external logo URL
          <img
            src={business.branding.logoUrl}
            alt={business.name}
            className="mx-auto mb-4 max-h-14 object-contain"
          />
        ) : (
          <p className="mb-4 text-lg font-bold text-slate-900">{business.name}</p>
        )}

        <p className="text-sm text-slate-500">Thẻ thành viên</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{name}</h1>

        {/* eslint-disable-next-line @next/next/no-img-element -- signed QR PNG endpoint */}
        <img
          src={qrSrc}
          alt={`Mã QR thành viên ${memberCode}`}
          width={256}
          height={256}
          className="mx-auto my-5 h-64 w-64 max-w-full rounded-xl border bg-white p-2"
        />

        <p className="text-sm text-slate-500">Mã thành viên</p>
        <p className="text-lg font-semibold tracking-wide text-slate-900">{memberCode}</p>

        <p className="mt-4 text-xs text-slate-400">
          Vui lòng lưu mã QR này để tích điểm mỗi lần ghé {business.name}.
        </p>
      </div>
    </main>
  );
}
