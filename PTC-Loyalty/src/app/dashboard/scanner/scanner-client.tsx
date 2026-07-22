"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  resolveQrToken,
  findCustomer,
  earnAction,
  type ResolvedCustomer,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatNumber } from "@/lib/format";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function ScannerClient() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<ResolvedCustomer | null>(null);
  const [amount, setAmount] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [query, setQuery] = useState("");
  const [idemKey, setIdemKey] = useState("");
  const [success, setSuccess] = useState<{ points: number; balance: number } | null>(null);

  const hasDetector =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const handleResolved = useCallback(
    (result: Awaited<ReturnType<typeof resolveQrToken>>) => {
      if (!result.ok) {
        toast({ variant: "destructive", title: "Không thành công", description: result.error });
        return;
      }
      setCustomer(result.customer);
      setIdemKey(crypto.randomUUID());
      setSuccess(null);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(80);
      stopCamera();
    },
    [toast, stopCamera],
  );

  // Decode a QR from the current video frame — native BarcodeDetector when
  // available (fast), otherwise a jsQR canvas fallback that works everywhere
  // (iOS Safari, Firefox, Safari desktop — none of which have BarcodeDetector).
  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    if (!scanningRef.current || !video) return;
    let raw: string | null = null;
    try {
      if (detectorRef.current) {
        const codes = await detectorRef.current.detect(video);
        if (codes.length > 0) raw = codes[0].rawValue;
      } else if (video.readyState >= 2 && video.videoWidth > 0) {
        const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const cctx = canvas.getContext("2d", { willReadFrequently: true });
        if (cctx) {
          cctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = cctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (found?.data) raw = found.data;
        }
      }
    } catch {
      /* transient detect/decode errors are ignored */
    }
    if (raw && scanningRef.current) {
      scanningRef.current = false;
      setBusy(true);
      const result = await resolveQrToken(raw);
      setBusy(false);
      handleResolved(result);
      return;
    }
    if (scanningRef.current) requestAnimationFrame(scanLoop);
  }, [handleResolved]);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Trình duyệt không hỗ trợ camera, hoặc trang không chạy trên HTTPS. Hãy dùng tìm kiếm thủ công bên dưới.",
      );
      return;
    }

    // Always try to open the camera — QR decoding falls back to jsQR if the
    // browser lacks BarcodeDetector. `ideal` (not `exact`) so desktops without a
    // rear camera still get a camera.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        const name = (err as DOMException)?.name;
        setCameraError(
          name === "NotAllowedError"
            ? "Bạn đã từ chối quyền camera. Hãy cấp quyền camera cho trang trong cài đặt trình duyệt rồi thử lại."
            : name === "NotFoundError"
              ? "Không tìm thấy camera trên thiết bị này."
              : "Không truy cập được camera. Kiểm tra quyền truy cập và đảm bảo trang chạy trên HTTPS.",
        );
        return;
      }
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    // Prefer native detector; otherwise the jsQR fallback in scanLoop is used.
    if (hasDetector) {
      try {
        // @ts-expect-error BarcodeDetector is not in TS DOM lib yet
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        detectorRef.current = null;
      }
    } else {
      detectorRef.current = null;
    }

    scanningRef.current = true;
    setCameraOn(true);
    requestAnimationFrame(scanLoop);
  }, [facingMode, hasDetector, scanLoop]);

  useEffect(() => stopCamera, [stopCamera]);

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await findCustomer(query);
    setBusy(false);
    handleResolved(result);
  }

  async function handleConfirm() {
    if (!customer) return;
    const value = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: "destructive", title: "Số tiền không hợp lệ" });
      return;
    }
    setBusy(true);
    const result = await earnAction({
      customerId: customer.id,
      amount: value,
      receiptRef: receiptRef || undefined,
      idempotencyKey: idemKey,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ variant: "destructive", title: "Thất bại", description: result.error });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([60, 40, 60]);
    setSuccess({ points: result.points ?? 0, balance: result.balanceAfter ?? 0 });
    toast({
      variant: "success",
      title: "Cộng điểm thành công",
      description: `+${result.points} điểm cho ${customer.name}`,
    });
  }

  function reset() {
    setCustomer(null);
    setAmount("");
    setReceiptRef("");
    setQuery("");
    setSuccess(null);
    setIdemKey("");
  }

  // ── Success screen ──
  if (success && customer) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="h-16 w-16 text-success" />
          <div>
            <h2 className="text-xl font-bold">Thành công!</h2>
            <p className="text-muted-foreground">{customer.name}</p>
          </div>
          <div className="flex w-full justify-around rounded-lg bg-secondary p-4">
            <div>
              <p className="text-xs text-muted-foreground">Điểm cộng</p>
              <p className="text-2xl font-bold text-success">+{formatNumber(success.points)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Số dư mới</p>
              <p className="text-2xl font-bold">{formatNumber(success.balance)}</p>
            </div>
          </div>
          <Button className="w-full" onClick={reset}>
            Quét khách tiếp theo
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Confirm screen ──
  if (customer) {
    const previewValue = parseFloat(amount.replace(",", "."));
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" /> {customer.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-secondary p-3 text-sm">
            <span className="text-muted-foreground">{customer.memberCode}</span>
            <div className="flex items-center gap-2">
              {customer.tier && <Badge>{customer.tier}</Badge>}
              <span className="font-semibold">
                {formatNumber(customer.pointsBalance)} P
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Số tiền hóa đơn (€)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt">Mã hóa đơn (tùy chọn)</Label>
            <Input
              id="receipt"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder="VD: RC-2026-001"
            />
            <p className="text-xs text-muted-foreground">
              Một hóa đơn chỉ được dùng một lần (chống gian lận).
            </p>
          </div>

          {Number.isFinite(previewValue) && previewValue > 0 && (
            <div className="rounded-lg border border-dashed p-3 text-sm">
              Số dư sau giao dịch (ước tính):{" "}
              <strong>{formatNumber(customer.pointsBalance)}</strong> + điểm mới
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={reset} disabled={busy}>
              Hủy
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận cộng điểm
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Scan / search screen ──
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Quét mã QR thành viên</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                <Camera className="h-10 w-10" />
                <p className="px-6 text-center text-sm">
                  Bật camera để quét mã QR của khách hàng
                </p>
              </div>
            )}
            {cameraOn && (
              <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/80" />
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>

          {cameraError && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {cameraError}
            </p>
          )}

          <div className="flex gap-2">
            {!cameraOn ? (
              <Button className="flex-1" onClick={startCamera}>
                <Camera className="h-4 w-4" /> Bật camera
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1" onClick={stopCamera}>
                  <CameraOff className="h-4 w-4" /> Tắt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    stopCamera();
                    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
                    setTimeout(startCamera, 200);
                  }}
                >
                  Đổi camera
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tìm khách thủ công</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mã TV, SĐT, email hoặc tên"
            />
            <Button type="submit" disabled={busy}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
