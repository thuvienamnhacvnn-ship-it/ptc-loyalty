import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

interface Props {
  preferredCameraId: string | null;
  onToken: (token: string) => void;
  disabled?: boolean;
}

/** Webcam QR scanner. Decodes with the native BarcodeDetector when available,
 *  else falls back to jsQR (canvas) — so it works even when Electron's Chromium
 *  ships without BarcodeDetector. USB scanners are handled separately (they act
 *  as keyboard input — see PosScreen). */
export function QrScanner({ preferredCameraId, onToken, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(preferredCameraId);

  const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stop = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  }, []);

  const loop = useCallback(async () => {
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
      /* transient detect/decode errors ignored */
    }
    if (raw && scanningRef.current) {
      scanningRef.current = false;
      onToken(raw);
      stop();
      return;
    }
    if (scanningRef.current) requestAnimationFrame(loop);
  }, [onToken, stop]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Không truy cập được camera trên thiết bị này. Dùng máy quét USB hoặc tìm thủ công.");
      return;
    }
    // Always open the camera; jsQR decodes if BarcodeDetector is unavailable.
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = {
        video: activeId
          ? { deviceId: { exact: activeId } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        setError("Không truy cập được camera. Kiểm tra quyền và thiết bị.");
        return;
      }
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput"));
    } catch {
      /* ignore */
    }
    if (hasDetector) {
      try {
        // @ts-expect-error BarcodeDetector not in TS DOM lib
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        detectorRef.current = null;
      }
    } else {
      detectorRef.current = null;
    }
    scanningRef.current = true;
    setOn(true);
    requestAnimationFrame(loop);
  }, [activeId, hasDetector, loop]);

  useEffect(() => stop, [stop]);

  function switchCamera(id: string) {
    setActiveId(id);
    stop();
    setTimeout(start, 150);
  }

  return (
    <div>
      <div className="scanner">
        <video ref={videoRef} muted playsInline />
        {on && <div className="frame" />}
        {!on && (
          <div className="overlay">
            <Camera size={34} />
            <span style={{ fontSize: 13 }}>Bật camera để quét mã QR khách hàng</span>
          </div>
        )}
      </div>

      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}

      <div className="row" style={{ marginTop: 10 }}>
        {!on ? (
          <button onClick={start} disabled={disabled}>
            <Camera size={16} /> Bật camera
          </button>
        ) : (
          <button className="ghost" onClick={stop}>
            <CameraOff size={16} /> Tắt camera
          </button>
        )}
        {cameras.length > 1 && on && (
          <select
            value={activeId ?? ""}
            onChange={(e) => switchCamera(e.target.value)}
            style={{ flex: 1 }}
          >
            {cameras.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || "Camera"}
              </option>
            ))}
          </select>
        )}
        {on && (
          <button className="ghost" title="Khởi động lại" onClick={() => switchCamera(activeId ?? "")}>
            <RefreshCw size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
