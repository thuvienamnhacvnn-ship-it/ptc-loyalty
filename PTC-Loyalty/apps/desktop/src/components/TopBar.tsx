import { Maximize, Settings, LogOut, Store, Wifi, WifiOff, Inbox, MessageCircle, Coins } from "lucide-react";
import { useSession } from "../state/SessionContext";

export function TopBar() {
  const s = useSession();
  if (!s.session) return null;
  const branch =
    s.session.branches.find((b) => b.id === s.branchId)?.name ?? "Tất cả chi nhánh";

  return (
    <div className="topbar">
      <div className="brand">
        <Store size={18} /> {s.session.business.name}
      </div>
      <span className="badge">{branch}</span>

      {s.online ? (
        <span className="pill online">
          <Wifi size={13} /> Trực tuyến
        </span>
      ) : (
        <span className="pill offline">
          <WifiOff size={13} /> Mất mạng
        </span>
      )}
      {s.queueCount > 0 && (
        <span className="pill queue">
          <Inbox size={13} /> {s.queueCount} chờ đồng bộ
        </span>
      )}

      <div className="spacer" />
      <div className="meta">
        {s.session.user.name ?? s.session.user.email}
        <br />
        {s.session.user.role}
      </div>
      <button
        className="ghost"
        title={s.phase === "whatsapp" ? "Màn hình bán hàng" : "WhatsApp"}
        onClick={() => s.setPhase(s.phase === "whatsapp" ? "pos" : "whatsapp")}
      >
        {s.phase === "whatsapp" ? <Coins size={16} /> : <MessageCircle size={16} />}
      </button>
      <button className="ghost" title="Toàn màn hình" onClick={() => window.pos.toggleFullscreen()}>
        <Maximize size={16} />
      </button>
      <button
        className="ghost"
        title="Cài đặt"
        onClick={() => s.setPhase(s.phase === "settings" ? "pos" : "settings")}
      >
        <Settings size={16} />
      </button>
      <button className="ghost" title="Đăng xuất" onClick={() => s.logout()}>
        <LogOut size={16} />
      </button>
    </div>
  );
}
