import { useEffect, useState } from "react";
import { Store, AlertCircle } from "lucide-react";
import { useSession } from "../state/SessionContext";
import { Spinner } from "../components/Spinner";

export function LoginScreen() {
  const { onLoggedIn, setPhase } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.pos.getSettings().then((s) => setBaseUrl(s.resolvedBaseUrl));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await window.pos.login(email.trim(), password, "PTC Loyalty Kasse");
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    // Re-fetch canonical session (branches etc.) then route.
    onLoggedIn({
      user: res.session.user,
      business: res.session.business,
      branches: res.session.branches,
      fixedBranchId: res.session.fixedBranchId,
    });
  }

  return (
    <div className="center">
      <div className="card" style={{ width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div
            style={{
              display: "inline-flex",
              padding: 14,
              borderRadius: 16,
              background: "var(--panel-2)",
              marginBottom: 10,
            }}
          >
            <Store size={26} color="var(--primary)" />
          </div>
          <h2 style={{ margin: 0 }}>PTC Loyalty · Quầy thu ngân</h2>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Đăng nhập bằng tài khoản nhân viên cửa hàng
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhanvien@cuahang.de"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pw">Mật khẩu</label>
            <input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="error-text" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <AlertCircle size={15} /> {error}
            </p>
          )}

          <button className="big" type="submit" disabled={busy}>
            {busy ? <Spinner /> : "Đăng nhập"}
          </button>
        </form>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <span className="hint">Máy chủ: {baseUrl || "…"}</span>
          <br />
          <button
            className="ghost"
            style={{ marginTop: 8, padding: "6px 12px", fontSize: 13 }}
            onClick={() => setPhase("settings")}
          >
            Cấu hình máy chủ / cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}
