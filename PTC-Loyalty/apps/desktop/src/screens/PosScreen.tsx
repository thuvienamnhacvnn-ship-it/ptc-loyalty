import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  UserRound,
  UserPlus,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  Printer,
  RotateCcw,
  Ticket,
  Gift,
  Coins,
  MessageCircle,
  CloudOff,
  RefreshCcw,
} from "lucide-react";
import type {
  PosCustomer,
  PosCustomerDetail,
  PosReward,
  PosTransactionResult,
  PosWhatsAppStatus,
} from "@shared/contract";
import { useSession } from "../state/SessionContext";
import { QrScanner } from "../components/QrScanner";
import { Spinner } from "../components/Spinner";
import { formatNumber, formatCurrency, formatDateTime, parseAmount, uuid } from "../lib/format";

type Tab = "earn" | "redeem" | "voucher";
type Result =
  | { kind: "success"; title: string; points: number; balance: number; whatsapp: PosWhatsAppStatus }
  | { kind: "queued"; title: string }
  | { kind: "error"; message: string };

const WA_LABEL: Record<PosWhatsAppStatus, string> = {
  NONE: "Không gửi WhatsApp",
  QUEUED: "WhatsApp: đang gửi…",
  SENT: "WhatsApp: đã gửi",
  DELIVERED: "WhatsApp: đã nhận",
  READ: "WhatsApp: đã đọc",
  FAILED: "WhatsApp: gửi lỗi",
};

export function PosScreen() {
  const s = useSession();
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [detail, setDetail] = useState<PosCustomerDetail | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("earn");
  const [result, setResult] = useState<Result | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

  // earn
  const [amount, setAmount] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  // redeem
  const [rewards, setRewards] = useState<PosReward[]>([]);
  const [selectedReward, setSelectedReward] = useState<string | null>(null);
  // voucher
  const [voucherCode, setVoucherCode] = useState("");
  // create customer + QR display
  const [showCreate, setShowCreate] = useState(false);
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cBirth, setCBirth] = useState("");
  const [qr, setQr] = useState<{ dataUrl: string; name: string; memberCode: string } | null>(null);

  // Anti-double-submit: one idempotency key per attempt; a hard in-flight guard.
  const idemRef = useRef<string>(uuid());
  const inFlight = useRef(false);

  useEffect(() => {
    window.pos.getSettings().then((cfg) => {
      setCameraId(cfg.settings.cameraId);
      setAutoPrint(cfg.settings.autoPrintReceipt);
    });
  }, []);

  const resetCustomer = useCallback(() => {
    setCustomer(null);
    setDetail(null);
    setAmount("");
    setReceiptRef("");
    setPreview(null);
    setVoucherCode("");
    setSelectedReward(null);
    setResult(null);
    setTab("earn");
    idemRef.current = uuid();
    inFlight.current = false;
  }, []);

  const loadCustomer = useCallback(async (c: PosCustomer) => {
    setLookupError(null);
    setCustomer(c);
    setResult(null);
    setAmount("");
    setReceiptRef("");
    setPreview(null);
    setTab("earn");
    idemRef.current = uuid();
    const d = await window.pos.customerDetail(c.id);
    if (d.ok) setDetail(d.detail);
    const r = await window.pos.rewards();
    if (r.ok) setRewards(r.rewards);
  }, []);

  const handleToken = useCallback(
    async (token: string) => {
      setBusy(true);
      const res = await window.pos.resolveQr(token);
      setBusy(false);
      if (!res.ok) {
        setLookupError(res.message);
        return;
      }
      loadCustomer(res.customer);
    },
    [loadCustomer],
  );

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setLookupError(null);
    const res = await window.pos.search(query.trim());
    setBusy(false);
    if (!res.ok) {
      setLookupError(res.message);
      return;
    }
    loadCustomer(res.customer);
  }

  // ── USB QR scanner (keyboard wedge) — active on the idle lookup screen ──────
  useEffect(() => {
    if (customer || result) return;
    let buf = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Ignore when typing in the manual search box.
      if (target.tagName === "INPUT" || target.tagName === "SELECT") return;
      const now = Date.now();
      if (now - last > 120) buf = ""; // gap → new scan
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 8) handleToken(buf);
        buf = "";
        return;
      }
      if (e.key.length === 1) buf += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customer, result, handleToken]);

  // ── Live points preview (debounced) ─────────────────────────────────────────
  useEffect(() => {
    if (!customer || tab !== "earn") return;
    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await window.pos.preview(customer.id, value);
      if (res.ok) setPreview(res.preview.points);
    }, 250);
    return () => clearTimeout(t);
  }, [amount, customer, tab]);

  function receiptFor(kind: "EARN" | "REDEEM" | "VOUCHER", points: number, balance: number, extra: string | null) {
    if (!customer || !s.session) return null;
    return {
      businessName: s.session.business.name,
      branchName: s.session.branches.find((b) => b.id === s.branchId)?.name ?? null,
      staffName: s.session.user.name ?? s.session.user.email,
      customerName: customer.name,
      memberCode: customer.memberCode,
      kind,
      points,
      amount: kind === "EARN" ? parseAmount(amount) : null,
      balanceAfter: balance,
      extra,
      when: formatDateTime(new Date().toISOString()),
    };
  }

  async function afterTxn(res: PosTransactionResult, title: string, kind: "EARN" | "REDEEM", extra: string | null) {
    setResult({
      kind: "success",
      title,
      points: res.points,
      balance: res.balanceAfter,
      whatsapp: res.whatsapp,
    });
    s.refreshConnectivity();
    if (autoPrint) {
      const r = receiptFor(kind, res.points, res.balanceAfter, extra);
      if (r) window.pos.printReceipt(r);
    }
  }

  // ── EARN ────────────────────────────────────────────────────────────────────
  async function confirmEarn() {
    if (!customer || inFlight.current) return;
    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setLookupError("Số tiền không hợp lệ.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const res = await window.pos.earn({
      customerId: customer.id,
      amount: value,
      receiptRef: receiptRef.trim() || undefined,
      idempotencyKey: idemRef.current,
      branchId: s.branchId,
    });
    setBusy(false);

    if (res.ok) {
      await afterTxn(res.result, "Cộng điểm thành công", "EARN", receiptRef.trim() || null);
      idemRef.current = uuid();
      inFlight.current = false;
      return;
    }
    if (res.offline) {
      // NEVER report success offline. Offer the encrypted queue.
      const save = window.confirm(
        "Mất kết nối máy chủ. Lưu giao dịch vào hàng đợi mã hoá để đồng bộ lại sau?\n\n" +
          "Giao dịch CHƯA được cộng điểm cho khách.",
      );
      if (save) {
        await window.pos.queueEnqueue({
          id: uuid(),
          idempotencyKey: idemRef.current,
          customerId: customer.id,
          customerName: customer.name,
          amount: value,
          receiptRef: receiptRef.trim() || null,
          branchId: s.branchId,
          createdAt: Date.now(),
        });
        await s.refreshQueue();
        setResult({ kind: "queued", title: "Đã lưu vào hàng đợi (chưa cộng điểm)" });
        idemRef.current = uuid();
      }
      inFlight.current = false;
      s.refreshConnectivity();
      return;
    }
    setResult({ kind: "error", message: res.message });
    inFlight.current = false;
  }

  // ── REDEEM ──────────────────────────────────────────────────────────────────
  async function confirmRedeem() {
    if (!customer || inFlight.current) return;
    const reward = rewards.find((r) => r.id === selectedReward);
    if (!reward) {
      setLookupError("Chọn phần thưởng để đổi.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    const res = await window.pos.redeem({
      customerId: customer.id,
      cost: reward.pointsCost,
      rewardId: reward.id,
      note: `Đổi: ${reward.name}`,
      idempotencyKey: idemRef.current,
      branchId: s.branchId,
    });
    setBusy(false);
    if (res.ok) {
      await afterTxn(res.result, `Đổi thưởng: ${reward.name}`, "REDEEM", reward.name);
      idemRef.current = uuid();
    } else if (res.offline) {
      setResult({ kind: "error", message: "Mất mạng — đổi điểm cần kết nối máy chủ." });
    } else {
      setResult({ kind: "error", message: res.message });
    }
    inFlight.current = false;
  }

  // ── VOUCHER ─────────────────────────────────────────────────────────────────
  async function confirmVoucher() {
    if (!customer || inFlight.current || !voucherCode.trim()) return;
    inFlight.current = true;
    setBusy(true);
    const res = await window.pos.voucherRedeem(voucherCode.trim());
    setBusy(false);
    if (res.ok) {
      setResult({ kind: "success", title: `Voucher hợp lệ: ${res.voucher.title}`, points: 0, balance: customer.pointsBalance, whatsapp: "NONE" });
    } else {
      setResult({ kind: "error", message: res.message });
    }
    inFlight.current = false;
  }

  // ── CREATE CUSTOMER + QR ──────────────────────────────────────────────────────
  async function confirmCreate() {
    if (!cFirst.trim() || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setLookupError(null);
    const res = await window.pos.createCustomer({
      firstName: cFirst.trim(),
      lastName: cLast.trim() || undefined,
      phone: cPhone.trim() || undefined,
      birthDate: cBirth || undefined,
    });
    setBusy(false);
    inFlight.current = false;
    if (!res.ok) {
      setLookupError(res.message);
      return;
    }
    setQr({ dataUrl: res.qr.dataUrl, name: res.customer.name, memberCode: res.customer.memberCode });
    setShowCreate(false);
    setCFirst("");
    setCLast("");
    setCPhone("");
    setCBirth("");
  }

  async function showCustomerQr() {
    if (!customer) return;
    setBusy(true);
    const res = await window.pos.customerQr(customer.id);
    setBusy(false);
    if (res.ok) {
      setQr({ dataUrl: res.qr.dataUrl, name: customer.name, memberCode: customer.memberCode });
    } else {
      setLookupError(res.message);
    }
  }

  async function syncQueue() {
    if (!window.confirm(`Đồng bộ ${s.queueCount} giao dịch đang chờ?`)) return;
    setBusy(true);
    const out = await window.pos.queueSync();
    setBusy(false);
    await s.refreshQueue();
    window.alert(
      `Đã đồng bộ: ${out.synced}/${out.total}. Lỗi: ${out.failed}.` +
        (out.stillOffline ? "\nVẫn còn mất mạng — thử lại sau." : ""),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QR screen (after create / view existing)
  // ─────────────────────────────────────────────────────────────────────────────
  if (qr) {
    return (
      <div className="center">
        <div className="card" style={{ width: 400, textAlign: "center" }}>
          <h2 style={{ marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <QrCode size={20} /> Mã QR thành viên
          </h2>
          <img
            src={qr.dataUrl}
            alt={`QR ${qr.memberCode}`}
            style={{ width: 280, height: 280, background: "#fff", borderRadius: 12, padding: 8 }}
          />
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600 }}>{qr.name}</div>
            <div className="muted">{qr.memberCode}</div>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Mã cố định — khách có thể chụp lại hoặc quét ngay để tích điểm.
          </p>
          <div className="row" style={{ marginTop: 6, justifyContent: "center" }}>
            <button onClick={() => setQr(null)}>
              <RotateCcw size={16} /> Xong
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULT screen (success / queued / error)
  // ─────────────────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="center">
        <div className="card" style={{ width: 440 }}>
          <div className="state">
            {result.kind === "success" && <CheckCircle2 size={56} color="var(--success)" />}
            {result.kind === "queued" && <CloudOff size={56} color="var(--warn)" />}
            {result.kind === "error" && <XCircle size={56} color="var(--danger)" />}
            <h2 style={{ margin: 0 }}>{result.kind === "error" ? "Không thành công" : result.title}</h2>
            {result.kind === "success" && (
              <>
                {result.points !== 0 && (
                  <div className="row" style={{ width: "100%" }}>
                    <div className="card" style={{ textAlign: "center", padding: 14 }}>
                      <div className="muted" style={{ fontSize: 12 }}>Điểm</div>
                      <div className="big-num" style={{ color: result.points > 0 ? "var(--success)" : "var(--danger)" }}>
                        {result.points > 0 ? "+" : ""}
                        {formatNumber(result.points)}
                      </div>
                    </div>
                    <div className="card" style={{ textAlign: "center", padding: 14 }}>
                      <div className="muted" style={{ fontSize: 12 }}>Số dư mới</div>
                      <div className="big-num">{formatNumber(result.balance)}</div>
                    </div>
                  </div>
                )}
                <span className="pill" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                  <MessageCircle size={13} /> {WA_LABEL[result.whatsapp]}
                </span>
              </>
            )}
            {result.kind === "queued" && (
              <p className="muted">Giao dịch được lưu mã hoá cục bộ. Hãy đồng bộ khi có mạng.</p>
            )}
            {result.kind === "error" && <p className="error-text">{result.message}</p>}

            <div className="row" style={{ width: "100%", marginTop: 6 }}>
              {result.kind === "success" && customer && (
                <button
                  className="ghost"
                  onClick={() => {
                    const r = receiptFor(
                      tab === "earn" ? "EARN" : tab === "redeem" ? "REDEEM" : "VOUCHER",
                      result.points,
                      result.balance,
                      null,
                    );
                    if (r) window.pos.printReceipt(r);
                  }}
                >
                  <Printer size={16} /> In biên nhận
                </button>
              )}
              <button onClick={resetCustomer}>
                <RotateCcw size={16} /> Khách tiếp theo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOMER screen (earn / redeem / voucher)
  // ─────────────────────────────────────────────────────────────────────────────
  if (customer) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="cols">
          {/* Left: customer info */}
          <div className="card">
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UserRound size={18} /> {customer.name}
            </h2>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="badge">{customer.memberCode}</span>
              {customer.tier && <span className="badge tier">{customer.tier}</span>}
            </div>
            {customer.phone && (
              <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                📞 {customer.phone}
              </div>
            )}
            <div className="card" style={{ background: "var(--panel-2)", textAlign: "center", marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Điểm hiện tại</div>
              <div className="big-num">{formatNumber(customer.pointsBalance)}</div>
            </div>
            <button className="ghost" style={{ width: "100%", marginBottom: 12 }} onClick={showCustomerQr} disabled={busy}>
              <QrCode size={15} /> Xem mã QR thành viên
            </button>
            <h3>Giao dịch gần đây</h3>
            {detail ? (
              detail.recentTransactions.length ? (
                detail.recentTransactions.map((t) => (
                  <div className="txn" key={t.id}>
                    <span>
                      {t.type} · {formatDateTime(t.createdAt)}
                    </span>
                    <span className={t.points >= 0 ? "pos" : "neg"}>
                      {t.points >= 0 ? "+" : ""}
                      {formatNumber(t.points)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>Chưa có giao dịch.</p>
              )
            ) : (
              <Spinner />
            )}
          </div>

          {/* Right: action */}
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <button className={tab === "earn" ? "" : "ghost"} onClick={() => setTab("earn")}>
                <Coins size={15} /> Cộng
              </button>
              <button className={tab === "redeem" ? "" : "ghost"} onClick={() => setTab("redeem")}>
                <Gift size={15} /> Đổi
              </button>
              <button className={tab === "voucher" ? "" : "ghost"} onClick={() => setTab("voucher")}>
                <Ticket size={15} /> Voucher
              </button>
            </div>

            {tab === "earn" && (
              <>
                <div className="field">
                  <label htmlFor="amount">Số tiền hóa đơn ({s.session?.business.currency})</label>
                  <input
                    id="amount"
                    inputMode="decimal"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="rc">Mã hóa đơn (tùy chọn)</label>
                  <input
                    id="rc"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    placeholder="VD: RC-2026-001"
                  />
                  <div className="hint">Một hóa đơn chỉ dùng một lần (chống gian lận).</div>
                </div>
                <div className="banner info">
                  Điểm dự kiến:{" "}
                  <strong>{preview != null ? `+${formatNumber(preview)}` : "—"}</strong>
                  {preview != null && (
                    <> → Số dư ~ {formatNumber(customer.pointsBalance + preview)}</>
                  )}
                </div>
                <button className="big success" onClick={confirmEarn} disabled={busy || !amount}>
                  {busy ? <Spinner /> : <>Xác nhận cộng điểm</>}
                </button>
              </>
            )}

            {tab === "redeem" && (
              <>
                <h3>Chọn phần thưởng</h3>
                <div className="grid" style={{ maxHeight: 260, overflow: "auto", marginBottom: 12 }}>
                  {rewards.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Chưa có phần thưởng.</p>}
                  {rewards.map((r) => {
                    const affordable = customer.pointsBalance >= r.pointsCost;
                    return (
                      <button
                        key={r.id}
                        className={selectedReward === r.id ? "" : "ghost"}
                        disabled={!affordable}
                        onClick={() => setSelectedReward(r.id)}
                        style={{ display: "flex", justifyContent: "space-between", padding: 12 }}
                      >
                        <span>{r.name}</span>
                        <span>{formatNumber(r.pointsCost)} P</span>
                      </button>
                    );
                  })}
                </div>
                <button className="big" onClick={confirmRedeem} disabled={busy || !selectedReward}>
                  {busy ? <Spinner /> : "Xác nhận đổi điểm"}
                </button>
              </>
            )}

            {tab === "voucher" && (
              <>
                <div className="field">
                  <label htmlFor="vc">Mã voucher của khách</label>
                  <input
                    id="vc"
                    autoFocus
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="VD: V-ABC123"
                  />
                </div>
                {detail && detail.vouchers.length > 0 && (
                  <>
                    <h3>Voucher đang có</h3>
                    <div className="grid" style={{ marginBottom: 12 }}>
                      {detail.vouchers.map((v) => (
                        <button
                          key={v.id}
                          className="ghost"
                          onClick={() => setVoucherCode(v.code)}
                          style={{ display: "flex", justifyContent: "space-between", padding: 10 }}
                        >
                          <span>{v.title}</span>
                          <span className="muted">{v.code}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button className="big" onClick={confirmVoucher} disabled={busy || !voucherCode.trim()}>
                  {busy ? <Spinner /> : "Xác nhận voucher"}
                </button>
              </>
            )}

            <button className="ghost" style={{ width: "100%", marginTop: 10 }} onClick={resetCustomer}>
              Hủy / Khách khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IDLE screen (scan / search)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }} className="grid">
      {s.queueCount > 0 && (
        <div className="banner warn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            <CloudOff size={15} /> {s.queueCount} giao dịch chưa đồng bộ (chưa cộng điểm).
          </span>
          <button style={{ padding: "6px 12px" }} onClick={syncQueue} disabled={busy}>
            <RefreshCcw size={14} /> Đồng bộ ngay
          </button>
        </div>
      )}

      <div className="card">
        <h2>Quét mã QR thành viên</h2>
        <QrScanner preferredCameraId={cameraId} onToken={handleToken} disabled={busy} />
        <div className="hint" style={{ marginTop: 8 }}>
          Máy quét QR USB (dạng bàn phím) cũng hoạt động — chỉ cần quét, không cần bật camera.
        </div>
      </div>

      <div className="card">
        <h3>Tìm khách thủ công</h3>
        <form onSubmit={handleSearch} className="row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mã TV, SĐT, email hoặc tên"
            style={{ flex: 3 }}
          />
          <button type="submit" disabled={busy} style={{ flex: 1 }}>
            {busy ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
          </button>
        </form>
        {lookupError && <p className="error-text" style={{ marginTop: 10 }}>{lookupError}</p>}
      </div>

      {/* Create a new customer (auto-generates a fixed membership QR) */}
      <div className="card">
        {!showCreate ? (
          <button className="ghost" style={{ width: "100%" }} onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Tạo khách hàng mới
          </button>
        ) : (
          <>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={16} /> Khách hàng mới
            </h3>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="cf">Tên *</label>
                <input id="cf" autoFocus value={cFirst} onChange={(e) => setCFirst(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="cl">Họ</label>
                <input id="cl" value={cLast} onChange={(e) => setCLast(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="cp">Số điện thoại</label>
                <input id="cp" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="+49 ..." />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="cb">Ngày sinh</label>
                <input id="cb" type="date" value={cBirth} onChange={(e) => setCBirth(e.target.value)} />
              </div>
            </div>
            <div className="hint" style={{ marginBottom: 8 }}>
              Có SĐT + WhatsApp đã cấu hình → tự gửi thẻ QR cho khách.
            </div>
            <button className="big success" onClick={confirmCreate} disabled={busy || !cFirst.trim()}>
              {busy ? <Spinner /> : <><QrCode size={16} /> Tạo khách &amp; sinh mã QR</>}
            </button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowCreate(false)}>
              Hủy
            </button>
          </>
        )}
      </div>
    </div>
  );
}
