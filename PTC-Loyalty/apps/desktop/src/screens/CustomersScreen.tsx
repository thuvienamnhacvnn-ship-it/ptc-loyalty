import { useCallback, useEffect, useState } from "react";
import { Search, Users, ChevronLeft, ChevronRight, Loader2, UserRound } from "lucide-react";
import type { PosCustomer } from "@shared/contract";
import { useSession } from "../state/SessionContext";
import { formatNumber } from "../lib/format";

const PAGE_SIZE = 25;

/** Browse / search ALL customers (tenant-scoped, paginated). Clicking a row
 *  opens that customer in the POS screen for earn / redeem / QR / edit. */
export function CustomersScreen() {
  const { openCustomer } = useSession();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PosCustomer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await window.pos.customersList({ q: debouncedQ || undefined, page, pageSize: PAGE_SIZE });
    setLoading(false);
    if (res.ok) {
      setRows(res.customers);
      setTotal(res.total);
    } else {
      setRows([]);
      setError(res.message);
    }
  }, [debouncedQ, page]);

  useEffect(() => {
    load();
  }, [load]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }} className="grid">
      <div className="card">
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 0 }}>
          <Users size={18} /> Khách hàng
          {total > 0 && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>({formatNumber(total)})</span>}
        </h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <Search size={16} className="muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên, SĐT, email, mã thành viên…"
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {error && <p className="error-text" style={{ padding: 14 }}>{error}</p>}

        {rows === null || loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Loader2 className="spinner" size={22} />
          </div>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ padding: 18, fontSize: 14 }}>
            {debouncedQ ? "Không tìm thấy khách hàng phù hợp." : "Chưa có khách hàng nào."}
          </p>
        ) : (
          <div>
            {rows.map((c) => (
              <button
                key={c.id}
                onClick={() => openCustomer(c)}
                className="ghost"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 0,
                  borderBottom: "1px solid var(--border)",
                  textAlign: "left",
                }}
              >
                <div className="row" style={{ alignItems: "center", gap: 10 }}>
                  <UserRound size={18} className="muted" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.memberCode}
                      {c.phone ? ` · ${c.phone}` : ""}
                      {c.tier ? ` · ${c.tier}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{formatNumber(c.pointsBalance)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>điểm</div>
                </div>
              </button>
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
