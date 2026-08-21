"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, LogIn, LogOut, Loader2 } from "lucide-react";
import { punchByToken, type PunchResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

/** Kết quả đứng trên màn hình ngần này rồi tự biến mất để nhường người sau. */
const RESULT_MS = 5000;
/** Cùng một thẻ dí trước camera liên tục thì chỉ tính một lần trong ngần này. */
const SAME_TOKEN_MS = 15_000;

/**
 * Máy chấm công. Khác màn hình quét khách ở chỗ nó chạy KHÔNG NGƯỜI TRÔNG:
 * mở một lần đầu ca rồi để nguyên trên tablet ở cửa nhân viên, ai tới thì dí
 * thẻ. Vì vậy camera không bao giờ tự tắt sau mỗi lần quét, và kết quả tự dọn
 * đi sau vài giây để người sau không nhìn thấy giờ công của người trước.
 */
export function KioskClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PunchResult | null>(null);
  const [clock, setClock] = useState<string>("");

  // Đồng hồ lớn trên màn hình. Vẽ sau khi mount chứ không render sẵn ở máy chủ:
  // giờ máy chủ là UTC, in ra rồi mới sửa lại sẽ nháy sai một nhịp.
  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  const showResult = useCallback((r: PunchResult) => {
    setResult(r);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(r.ok ? 80 : [60, 60, 60]);
    }
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => setResult(null), RESULT_MS);
  }, []);

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
      /* lỗi giải mã từng khung hình là chuyện thường, bỏ qua */
    }

    if (raw && scanningRef.current) {
      const now = Date.now();
      const last = lastTokenRef.current;
      // Thẻ để quên trước camera sẽ được đọc lại vài chục lần mỗi giây. Không
      // chặn ở đây thì mỗi khung hình là một lần vào/ra.
      const isRepeat = last && last.token === raw && now - last.at < SAME_TOKEN_MS;
      if (!isRepeat) {
        lastTokenRef.current = { token: raw, at: now };
        setBusy(true);
        const r = await punchByToken(raw);
        setBusy(false);
        showResult(r);
      }
    }
    if (scanningRef.current) requestAnimationFrame(scanLoop);
  }, [showResult]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt không hỗ trợ camera, hoặc trang không chạy trên HTTPS.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        const name = (err as DOMException)?.name;
        setCameraError(
          name === "NotAllowedError"
            ? "Bạn đã từ chối quyền camera. Cấp lại quyền cho trang rồi thử lại."
            : name === "NotFoundError"
              ? "Không tìm thấy camera trên thiết bị này."
              : "Không mở được camera. Kiểm tra quyền và đảm bảo trang chạy trên HTTPS.",
        );
        return;
      }
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    // BarcodeDetector nhanh hơn nhiều nhưng vắng mặt trên iOS Safari, Firefox và
    // cả Electron trên Windows — thiếu nó thì jsQR gánh, đừng khoá camera theo nó.
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        // @ts-expect-error BarcodeDetector chưa có trong TS DOM lib
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
  }, [scanLoop]);

  useEffect(
    () => () => {
      stopCamera();
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    },
    [stopCamera],
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-video w-full bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              aria-label="Camera máy chấm công"
            />

            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-200">
                <CameraOff className="h-10 w-10 opacity-70" />
                <p className="max-w-sm px-6 text-center text-sm opacity-80">
                  {cameraError ?? "Bật camera rồi để nguyên màn hình này ở cửa nhân viên."}
                </p>
                <Button onClick={startCamera} size="lg">
                  <Camera className="h-4 w-4" /> Bật máy chấm công
                </Button>
              </div>
            )}

            {cameraOn && !result && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6">
                <span className="rounded-full bg-black/50 px-4 py-1 text-3xl font-semibold tabular-nums text-white">
                  {clock}
                </span>
                <div className="h-40 w-40 rounded-2xl border-4 border-white/70" />
                <span className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">
                  {busy ? "Đang xử lý…" : "Đưa thẻ nhân viên vào khung"}
                </span>
              </div>
            )}

            {result && <PunchOverlay result={result} />}
          </div>
        </CardContent>
      </Card>

      {cameraOn && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={stopCamera}>
            <CameraOff className="h-4 w-4" /> Tắt camera
          </Button>
        </div>
      )}
    </div>
  );
}

/** Tấm phủ báo kết quả — chữ to để nhìn được từ xa, không cần tới sát máy. */
function PunchOverlay({ result }: { result: PunchResult }) {
  if (!result.ok) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-600/95 p-6 text-white">
        <AlertTriangle className="h-12 w-12" />
        <p className="text-center text-xl font-semibold">{result.error}</p>
      </div>
    );
  }

  const isIn = result.action === "IN";
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-white ${
        isIn ? "bg-emerald-600/95" : "bg-sky-700/95"
      }`}
    >
      {isIn ? <LogIn className="h-12 w-12" /> : <LogOut className="h-12 w-12" />}
      <p className="text-sm uppercase tracking-widest opacity-90">
        {isIn ? "Đã vào ca" : "Đã tan ca"}
      </p>
      <p className="text-center text-3xl font-bold">{result.staffName}</p>
      <p className="text-4xl font-bold tabular-nums">{result.atLabel}</p>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {result.departmentName && (
          <span className="rounded-full bg-white/20 px-3 py-1">{result.departmentName}</span>
        )}
        {result.shiftLabel && (
          <span className="rounded-full bg-white/20 px-3 py-1">{result.shiftLabel}</span>
        )}
        {result.workedLabel && (
          <span className="rounded-full bg-white/20 px-3 py-1">
            Hôm nay làm {result.workedLabel}
          </span>
        )}
      </div>

      {result.notes.length > 0 && (
        <ul className="mt-2 max-w-md space-y-1 text-center text-sm opacity-95">
          {result.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}

      {result.notes.length === 0 && (
        <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
          <CheckCircle2 className="h-4 w-4" /> Đúng giờ
        </p>
      )}
    </div>
  );
}

/** Ô nhỏ hiển thị lúc đang gọi máy chủ, dùng khi nhúng ở nơi khác. */
export function KioskBusy() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
