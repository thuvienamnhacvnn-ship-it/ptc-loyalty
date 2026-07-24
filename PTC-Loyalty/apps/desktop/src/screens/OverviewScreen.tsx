import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Coins, Receipt, Loader2, RefreshCcw } from "lucide-react";
import type { PosStats, PosTransactionListItem } from "@shared/contract";
import { useSession } from "../state/SessionContext";
import { formatNumber, formatDateTime } from "../lib/format";
import { txLabel, txColor } from "../lib/tx";

/** Counter dashboard: today's stats + a preview of recent transactions. */
export function OverviewScreen() {
  const { setPhase } = useSession();
  const [stats, setStats] = useState<PosStats | null>(null);
  const [recent, setRecent] = useState<PosTransactionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [s, t] = await Promise.all([
      window.pos.stats(),
      window.pos.transactionsList({ page: 1, pageSize: 8 }),
    ]);
    if (s.ok) setStats(s.stats);
    else setError(s.message);
    if (t.ok) setRecent(t.items);
    else setRecent([]);
  }

  useEffect(() => {
    load();
  }, []);

  const cards = stats
    ? [
        { label: "Khách hàng", value: stats.customersTotal, sub: `+${stats.customersNewToday} hôm nay`, icon: Users, color: "var(--accent)" },
        { label: "Điểm cộng hôm nay", value: stats.pointsEarnedToday, sub: "điểm", icon: Coins, color: "var(--success)" },
        { label: "Điểm đổi hôm nay", value: stats.pointsRedeemedToday, sub: "điểm", icon: Coins, color: "var(--warn)" },
        { label: "Giao dịch hôm nay", value: stats.transactionsToday, sub: `${formatNumber(stats.transactionsTotal)} tổng`, icon: Receipt, color: "var(--accent)" },
      ]
    : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="grid">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <LayoutDashboard size={18} /> Tổng quan
        </h2>
        <button className="ghost" style={{ padding: "6px 12px" }} onClick={load}>
          <RefreshCcw size={14} /> Làm mới
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!stats ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2 className="spinner" size={22} />
        </div>
      ) : (
        <div className="cols" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="card">
                <div className="row" style={{ alignItems: "center", gap: 8 }}>
                  <Icon size={16} style={{ color: c.color }} />
                  <span className="muted" style={{ fontSize: 13 }}>{c.label}</span>
                </div>
                <div className="big-num" style={{ marginTop: 4 }}>{formatNumber(c.value)}</div>
                <div className="muted" style={{ fontSize: 12 }}>{c.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
          <h3 style={{ margin: 0 }}>Giao dịch gần đây</h3>
          <button className="ghost" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => setPhase("transactions")}>
            Xem tất cả
          </button>
        </div>
        {recent === null ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Loader2 className="spinner" size={20} />
          </div>
        ) : recent.length === 0 ? (
          <p className="muted" style={{ padding: "0 16px 16px", fontSize: 13 }}>Chưa có giao dịch nào.</p>
        ) : (
          <div>
            {recent.map((t) => (
              <div
                key={t.id}
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--border)" }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.customerName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {txLabel(t.type)} · {formatDateTime(t.createdAt)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: txColor(t.points) }}>
                  {t.points > 0 ? "+" : ""}
                  {formatNumber(t.points)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
