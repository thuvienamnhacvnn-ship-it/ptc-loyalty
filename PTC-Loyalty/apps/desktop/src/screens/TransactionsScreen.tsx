import { useCallback, useEffect, useState } from "react";
import { Receipt, ChevronLeft, ChevronRight, Loader2, RefreshCcw } from "lucide-react";
import type { PosTransactionListItem } from "@shared/contract";
import { formatNumber, formatDateTime } from "../lib/format";
import { txLabel, txColor } from "../lib/tx";

const PAGE_SIZE = 25;

/** Store-wide transaction history (paginated). */
export function TransactionsScreen() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PosTransactionListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await window.pos.transactionsList({ page, pageSize: PAGE_SIZE });
    setLoading(false);
    if (res.ok) {
      setRows(res.items);
      setTotal(res.total);
    } else {
      setRows([]);
      setError(res.message);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="grid">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <Receipt size={18} /> Lịch sử giao dịch
          {total > 0 && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>({formatNumber(total)})</span>}
        </h2>
        <button className="ghost" style={{ padding: "6px 12px" }} onClick={load}>
          <RefreshCcw size={14} /> Làm mới
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {error && <p className="error-text" style={{ padding: 14 }}>{error}</p>}

        {rows === null || loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Loader2 className="spinner" size={22} />
          </div>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ padding: 18, fontSize: 14 }}>Chưa có giao dịch nào.</p>
        ) : (
          <div>
            {rows.map((t) => (
              <div
                key={t.id}
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: "1px solid var(--border)" }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{t.customerName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.memberCode} · {txLabel(t.type)}
                    {t.note ? ` · ${t.note}` : ""} · {formatDateTime(t.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: txColor(t.points) }}>
                    {t.points > 0 ? "+" : ""}
                    {formatNumber(t.points)}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>dư {formatNumber(t.balanceAfter)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lastPage > 1 && (
        <div className="row" style={{ justifyContent: "center", alignItems: "center", gap: 12 }}>
          <button className="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={16} /> Trước
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            Trang {page} / {lastPage}
          </span>
          <button className="ghost" disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>
            Sau <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
