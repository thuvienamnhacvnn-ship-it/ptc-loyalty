"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw } from "lucide-react";
import { formatNumber } from "@/lib/format";

interface Props {
  businessName: string;
  memberName: string;
  memberCode: string;
  points: number;
  tierName: string | null;
  tierColor: string | null;
  primaryColor: string;
}

export function MemberCard({
  businessName,
  memberName,
  memberCode,
  points,
  tierName,
  tierColor,
  primaryColor,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(60);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/member/qr", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setDataUrl(json.dataUrl);
        setCountdown(json.expiresIn ?? 60);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refresh();
          return 60;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-2xl p-6 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${tierColor ?? primaryColor})`,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">{businessName}</p>
            <p className="text-xl font-bold">{memberName}</p>
          </div>
          {tierName && (
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
              {tierName}
            </span>
          )}
        </div>
        <div className="mt-6">
          <p className="text-sm opacity-80">Điểm hiện tại</p>
          <p className="text-4xl font-bold">{formatNumber(points)}</p>
        </div>
        <p className="mt-4 font-mono text-sm opacity-90">{memberCode}</p>
      </div>

      <div className="flex flex-col items-center rounded-2xl border bg-card p-6">
        <div className="relative flex h-[240px] w-[240px] items-center justify-center rounded-xl bg-white p-3">
          {loading && !dataUrl ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : dataUrl ? (
            <Image src={dataUrl} alt="QR thành viên" width={216} height={216} unoptimized />
          ) : (
            <p className="text-sm text-muted-foreground">Không tải được QR</p>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Đưa mã này cho nhân viên để tích điểm.
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          Mã tự làm mới sau {countdown}s (bảo mật động)
        </div>
      </div>

      <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
        💡 Mẹo: dùng menu trình duyệt →{" "}
        <span className="font-medium text-foreground">Thêm vào màn hình chính</span>{" "}
        để cài đặt như một app (PWA).
      </div>
    </div>
  );
}
