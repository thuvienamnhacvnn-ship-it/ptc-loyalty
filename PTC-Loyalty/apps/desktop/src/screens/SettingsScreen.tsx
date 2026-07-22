import { useEffect, useState } from "react";
import { ArrowLeft, Wifi, Save, RotateCcw } from "lucide-react";
import type { AppSettings } from "../../shared";
import { useSession } from "../state/SessionContext";
import { Spinner } from "../components/Spinner";

export function SettingsScreen() {
  const { session, setPhase, refreshConnectivity } = useSession();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [defaultBaseUrl, setDefaultBaseUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [printers, setPrinters] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [pingMsg, setPingMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await window.pos.getSettings();
      setSettings(cfg.settings);
      setDefaultBaseUrl(cfg.defaultBaseUrl);
      setApiUrl(cfg.settings.apiBaseUrl ?? "");
      setPrinters(await window.pos.listPrinters());
      try {
        // Requesting permission first makes device labels visible.
        await navigator.mediaDevices.getUserMedia({ video: true }).then((st) => st.getTracks().forEach((t) => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((d) => d.kind === "videoinput"));
      } catch {
        /* camera optional */
      }
    })();
  }, []);

  function patch(p: Partial<AppSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setSaveErr(null);
    setSaveMsg(null);
    const res = await window.pos.setSettings({
      ...settings,
      apiBaseUrl: apiUrl.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setSaveErr(res.error);
      return;
    }
    setSaveMsg("Đã lưu cài đặt.");
    refreshConnectivity();
  }

  async function testConnection() {
    setPingMsg("Đang kiểm tra…");
    // Save the URL first so the probe uses it.
    if (settings) await window.pos.setSettings({ ...settings, apiBaseUrl: apiUrl.trim() || null });
    const ok = await window.pos.ping();
    setPingMsg(ok ? "✓ Kết nối máy chủ thành công." : "✗ Không kết nối được máy chủ.");
  }

  if (!settings) return <div className="center"><Spinner /></div>;

  return (
    <div className="center">
      <div style={{ width: 560 }}>
        <button className="ghost" style={{ marginBottom: 14 }} onClick={() => setPhase(session ? "pos" : "login")}>
          <ArrowLeft size={16} /> Quay lại
        </button>

        <div className="card">
          <h2>Cài đặt máy trạm</h2>

          {/* API server */}
          <div className="field">
            <label>Địa chỉ máy chủ API</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={defaultBaseUrl}
            />
            <div className="hint">
              Để trống để dùng mặc định ({defaultBaseUrl}). Production bắt buộc HTTPS; chỉ localhost mới cho phép HTTP.
            </div>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="ghost" onClick={testConnection}>
              <Wifi size={15} /> Kiểm tra kết nối
            </button>
            {pingMsg && <span className="muted" style={{ alignSelf: "center", flex: 2 }}>{pingMsg}</span>}
          </div>

          {/* Camera */}
          <div className="field">
            <label>Camera quét QR</label>
            <select
              value={settings.cameraId ?? ""}
              onChange={(e) => patch({ cameraId: e.target.value || null })}
            >
              <option value="">Mặc định</option>
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || "Camera"}
                </option>
              ))}
            </select>
          </div>

          {/* Printer */}
          <div className="field">
            <label>Máy in biên nhận</label>
            <select
              value={settings.printerName ?? ""}
              onChange={(e) => patch({ printerName: e.target.value || null })}
            >
              <option value="">Máy in mặc định của hệ thống</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName}
                  {p.isDefault ? " (mặc định)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input
              type="checkbox"
              style={{ width: 18, height: 18 }}
              checked={settings.autoPrintReceipt}
              onChange={(e) => patch({ autoPrintReceipt: e.target.checked })}
            />
            Tự động in biên nhận sau mỗi giao dịch
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <input
              type="checkbox"
              style={{ width: 18, height: 18 }}
              checked={settings.kioskMode}
              onChange={(e) => patch({ kioskMode: e.target.checked })}
            />
            Chế độ Kiosk (toàn màn hình, khoá thao tác hệ thống)
          </label>

          {saveErr && <p className="error-text">{saveErr}</p>}
          {saveMsg && <p style={{ color: "var(--success)", fontSize: 14 }}>{saveMsg}</p>}

          <div className="row">
            <button className="ghost" onClick={() => window.pos.toggleFullscreen()}>
              <RotateCcw size={15} /> Bật/tắt toàn màn hình
            </button>
            <button onClick={save} disabled={busy}>
              {busy ? <Spinner /> : <><Save size={15} /> Lưu cài đặt</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
