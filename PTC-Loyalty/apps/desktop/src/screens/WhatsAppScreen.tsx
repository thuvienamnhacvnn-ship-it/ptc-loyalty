import { useCallback, useEffect, useState } from "react";
import { Send, RefreshCcw, MessageCircle, Loader2 } from "lucide-react";
import type { PosWhatsAppMessage } from "@shared/contract";
import { Spinner } from "../components/Spinner";
import { formatDateTime } from "../lib/format";

export function WhatsAppScreen() {
  const [messages, setMessages] = useState<PosWhatsAppMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await window.pos.whatsappMessages(50);
    if (res.ok) setMessages(res.messages);
    else {
      setMessages([]);
      setLoadError(res.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!to.trim() || !text.trim() || sending) return;
    setSending(true);
    setSendError(null);
    setSentOk(false);
    const res = await window.pos.whatsappSend({ to: to.trim(), message: text.trim() });
    setSending(false);
    if (res.ok) {
      setSentOk(true);
      setText("");
      await load();
      setTimeout(() => setSentOk(false), 2500);
    } else {
      setSendError(res.message);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }} className="grid">
      {/* Compose */}
      <div className="card">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 0 }}>
          <MessageCircle size={18} /> Gửi tin nhắn WhatsApp
        </h2>
        <div className="field">
          <label htmlFor="wto">Số điện thoại người nhận</label>
          <input
            id="wto"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="VD: 4915112345678 (E.164, không dấu +)"
          />
        </div>
        <div className="field">
          <label htmlFor="wtext">Nội dung</label>
          <textarea
            id="wtext"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Nhập nội dung tin nhắn…"
            style={{ resize: "vertical", width: "100%" }}
          />
          <div className="hint">
            Tin nhắn văn bản chỉ gửi được trong 24 giờ kể từ khi khách nhắn cho bạn.
          </div>
        </div>
        {sendError && <p className="error-text">{sendError}</p>}
        {sentOk && <p style={{ color: "var(--success)" }}>✓ Đã gửi</p>}
        <button className="big success" onClick={send} disabled={sending || !to.trim() || !text.trim()}>
          {sending ? <Spinner /> : <><Send size={16} /> Gửi</>}
        </button>
      </div>

      {/* Conversation / history */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Tin nhắn gần đây</h3>
          <button className="ghost" style={{ padding: "6px 12px" }} onClick={load}>
            <RefreshCcw size={14} /> Làm mới
          </button>
        </div>

        {loadError && <p className="error-text" style={{ marginTop: 10 }}>{loadError}</p>}

        {messages === null ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Loader2 className="spinner" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Chưa có tin nhắn nào.</p>
        ) : (
          <div className="grid" style={{ gap: 8, marginTop: 10 }}>
            {messages.map((m) => {
              const inbound = m.direction === "INBOUND";
              return (
                <div
                  key={m.id}
                  className="card"
                  style={{
                    padding: 10,
                    background: inbound ? "var(--panel-2)" : "rgba(37,99,235,0.10)",
                    marginLeft: inbound ? 0 : 40,
                    marginRight: inbound ? 40 : 0,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span className="muted">
                      {inbound ? `← ${m.customerName ?? m.fromPhone ?? "Khách"}` : `→ ${m.customerName ?? m.toPhone}`}
                    </span>
                    <span className="muted">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>{m.text || <em className="muted">(không có nội dung)</em>}</div>
                  {!inbound && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {m.status}
                      {m.error ? ` · ${m.error}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
