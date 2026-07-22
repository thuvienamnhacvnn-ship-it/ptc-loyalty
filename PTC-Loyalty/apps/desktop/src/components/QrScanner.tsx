import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

interface Props {
  preferredCameraId: string | null;
  onToken: (token: string) => void;
  disabled?: boolean;
}

/** Webcam QR scanner with camera selection. Uses the browser BarcodeDetector
 *  available in Electron's Chromium. USB scanners are handled separately (they
 *  act as keyboard input — see PosScreen). */
export function QrScanner({ preferredCameraId, onToken, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
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

  const loop = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
    detectorRef.current
      .detect(videoRef.current)
      .then((codes) => {
        if (codes.length > 0 && scanningRef.current) {
          scanningRef.current = false;
          onToken(codes[0].rawValue);
          stop();
          return;
        }
        if (scanningRef.current) requestAnimationFrame(loop);
      })
      .catch(() => {
        if (scanningRef.current) requestAnimationFrame(loop);
      });
  }, [onToken, stop]);

  const start = useCallback(async () => {
    setError(null);
    if (!hasDetector) {
      setError("Trình duyệt không hỗ trợ quét QR tự động. Dùng máy quét USB hoặc tìm thủ công.");
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        video: activeId ? { deviceId: { exact: activeId } } : { facingMode: "environment" },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput"));
      // @ts-expect-error BarcodeDetector not in TS DOM lib
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanningRef.current = true;
      setOn(true);
      requestAnimationFrame(loop);
    } catch {
      setError("Không truy cập được camera. Kiểm tra quyền và thiết bị.");
    }
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
