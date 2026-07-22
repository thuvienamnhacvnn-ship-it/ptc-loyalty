import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "./state/SessionContext";
import { TopBar } from "./components/TopBar";
import { FullLoader } from "./components/Spinner";
import { LoginScreen } from "./screens/LoginScreen";
import { BranchSelectScreen } from "./screens/BranchSelectScreen";
import { PosScreen } from "./screens/PosScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WhatsAppScreen } from "./screens/WhatsAppScreen";

function UpdateBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    return window.pos.onUpdate((channel, payload) => {
      const p = payload as { version?: string; percent?: number; message?: string };
      if (channel === "update:available") setMsg(`Đang tải bản cập nhật ${p.version}…`);
      if (channel === "update:progress") setMsg(`Đang tải cập nhật… ${p.percent}%`);
      if (channel === "update:ready") {
        setMsg(`Bản cập nhật ${p.version} đã sẵn sàng.`);
        setReady(true);
      }
      if (channel === "update:error") setMsg(null);
    });
  }, []);
  if (!msg) return null;
  return (
    <div className="banner info" style={{ margin: "10px 16px 0" }}>
      {msg}{" "}
      {ready && (
        <button style={{ marginLeft: 8, padding: "4px 10px" }} onClick={() => window.pos.installUpdate()}>
          Cài đặt & khởi động lại
        </button>
      )}
    </div>
  );
}

function Router() {
  const { phase } = useSession();
  if (phase === "loading") return <FullLoader label="Đang khởi động…" />;
  if (phase === "login") return <LoginScreen />;
  if (phase === "branch") return <BranchSelectScreen />;
  // Settings is reachable both before login (to configure the server) and after.
  if (phase === "settings") return <SettingsScreen />;
  return (
    <div className="app">
      <TopBar />
      <UpdateBanner />
      <div className="content">
        {phase === "whatsapp" ? <WhatsAppScreen /> : <PosScreen />}
      </div>
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Router />
    </SessionProvider>
  );
}
