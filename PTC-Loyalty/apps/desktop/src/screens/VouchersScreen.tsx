import { useEffect, useState } from "react";
import { Ticket, Loader2, RefreshCcw } from "lucide-react";
import type { PosVoucherListItem } from "@shared/contract";
import { formatNumber } from "../lib/format";

const STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Đang chạy", color: "var(--success)" },
  DRAFT: { label: "Nháp", color: "var(--muted)" },
  PAUSED: { label: "Tạm dừng", color: "var(--warn)" },
  EXPIRED: { label: "Hết hạn", color: "var(--danger)" },
  ARCHIVED: { label: "Lưu trữ", color: "var(--muted)" },
};

function discountText(v: PosVoucherListItem): string {
  if (v.discountType === "percent") return `Giảm ${formatNumber(v.discountValue)}%`;
  if (v.discountType === "fixed") return `Giảm ${formatNumber(v.discountValue)}€`;
  if (v.discountType === "free_item") return "Tặng món/quà";
  return `${v.discountType} ${formatNumber(v.discountValue)}`;
}

/** Store voucher catalog (view-only) for the counter. */
export function VouchersScreen() {
  const [vouchers, setVouchers] = useState<PosVoucherListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await window.pos.vouchersList();
    if (res.ok) setVouchers(res.vouchers);
    else {
      setVouchers([]);
      setError(res.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }} className="grid">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <Ticket size={18} /> Voucher
          {vouchers && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>({vouchers.length})</span>}
        </h2>
        <button className="ghost" style={{ padding: "6px 12px" }} onClick={load}>
          <RefreshCcw size={14} /> Làm mới
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {vouchers === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2 className="spinner" size={22} />
        </div>
      ) : vouchers.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>Chưa có voucher nào.</p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {vouchers.map((v) => {
            const st = STATUS[v.status] ?? { label: v.status, color: "var(--muted)" };
            return (
              <div key={v.id} className="card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{v.title}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      <span className="badge" style={{ marginRight: 6 }}>{v.code}</span>
                      {discountText(v)}
                      {v.pointsCost > 0 ? ` · ${formatNumber(v.pointsCost)} điểm` : ""}
                    </div>
                  </div>
                  <span className="pill" style={{ background: "var(--panel-2)", color: st.color, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Đã phát: {formatNumber(v.issuedCount)}
                  {v.quantity !== null ? ` / ${formatNumber(v.quantity)}` : " (không giới hạn)"}
                  {v.expiresAt ? ` · HSD ${new Date(v.expiresAt).toLocaleDateString("vi-VN")}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
