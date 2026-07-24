import { useEffect, useState } from "react";
import { Gift, Loader2, RefreshCcw, Coins } from "lucide-react";
import type { PosReward } from "@shared/contract";
import { formatNumber } from "../lib/format";

/** Active rewards catalog (view-only) for the counter. */
export function RewardsScreen() {
  const [rewards, setRewards] = useState<PosReward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await window.pos.rewards();
    if (res.ok) setRewards(res.rewards);
    else {
      setRewards([]);
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
          <Gift size={18} /> Quà đổi điểm
          {rewards && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>({rewards.length})</span>}
        </h2>
        <button className="ghost" style={{ padding: "6px 12px" }} onClick={load}>
          <RefreshCcw size={14} /> Làm mới
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {rewards === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2 className="spinner" size={22} />
        </div>
      ) : rewards.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>Chưa có quà nào đang hoạt động.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {rewards.map((r) => (
            <div key={r.id} className="card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <span className="pill" style={{ background: "var(--panel-2)", color: "var(--success)", whiteSpace: "nowrap" }}>
                  <Coins size={13} /> {formatNumber(r.pointsCost)}
                </span>
              </div>
              {r.description && (
                <p className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>{r.description}</p>
              )}
              {r.stock !== null && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Còn: {formatNumber(r.stock)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
