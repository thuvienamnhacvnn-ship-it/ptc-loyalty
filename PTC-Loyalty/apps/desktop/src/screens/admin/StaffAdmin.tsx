import { useEffect, useState } from "react";
import { UserPlus, Loader2, Lock, Unlock, ShieldCheck } from "lucide-react";
import type { PosStaff } from "@shared/contract";
import { useSession } from "../../state/SessionContext";
import { Spinner } from "../../components/Spinner";

const ROLE_LABEL: Record<string, string> = {
  BUSINESS_OWNER: "Chủ",
  BUSINESS_MANAGER: "Quản lý",
  STAFF: "Nhân viên",
};

/** Staff management (list + add + activate/deactivate), tenant-scoped and
 *  role-gated: managers add STAFF, owners add managers too. */
export function StaffAdmin() {
  const s = useSession();
  const isOwner = s.session?.user.role === "BUSINESS_OWNER";
  const branches = s.session?.branches ?? [];

  const [staff, setStaff] = useState<PosStaff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STAFF" | "BUSINESS_MANAGER">("STAFF");
  const [branchId, setBranchId] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await window.pos.staffList();
    if (res.ok) setStaff(res.staff);
    else {
      setStaff([]);
      setError(res.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitAdd() {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    const res = await window.pos.staffAdd({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      branchId: branchId || null,
      maxPointsGrant: maxPoints ? Number(maxPoints) : null,
    });
    setAdding(false);
    if (!res.ok) {
      setAddError(res.message);
      return;
    }
    setShowAdd(false);
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    setBranchId("");
    setMaxPoints("");
    await load();
  }

  async function toggle(id: string) {
    setBusyId(id);
    const res = await window.pos.staffToggle(id);
    setBusyId(null);
    if (res.ok) await load();
    else setError(res.message);
  }

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={16} /> Nhân viên {staff && <span className="muted" style={{ fontWeight: 400 }}>({staff.length})</span>}
        </h3>
        <button onClick={() => setShowAdd((v) => !v)}>
          <UserPlus size={15} /> Thêm nhân viên
        </button>
      </div>

      {showAdd && (
        <div className="card">
          <div className="cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field"><label>Tên *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Email *</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
            <div className="field"><label>Mật khẩu * (≥8 ký tự)</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></div>
            <div className="field">
              <label>Vai trò</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "STAFF" | "BUSINESS_MANAGER")}>
                <option value="STAFF">Nhân viên</option>
                {isOwner && <option value="BUSINESS_MANAGER">Quản lý</option>}
              </select>
            </div>
            {branches.length > 0 && (
              <div className="field">
                <label>Chi nhánh (tùy chọn)</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Tất cả chi nhánh</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="field"><label>Giới hạn điểm/giao dịch (tùy chọn)</label><input value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} inputMode="numeric" /></div>
          </div>
          {addError && <p className="error-text">{addError}</p>}
          <div className="row">
            <button className="success" onClick={submitAdd} disabled={adding || !name.trim() || !email.trim() || password.length < 8}>
              {adding ? <Spinner /> : "Tạo nhân viên"}
            </button>
            <button className="ghost" onClick={() => setShowAdd(false)}>Hủy</button>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0 }}>
        {staff === null ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 28 }}><Loader2 className="spinner" size={20} /></div>
        ) : staff.length === 0 ? (
          <p className="muted" style={{ padding: 16, fontSize: 14 }}>Chưa có nhân viên nào.</p>
        ) : (
          staff.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {m.name ?? m.email}{" "}
                  <span className="badge" style={{ marginLeft: 4 }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                  {!m.isActive && <span className="badge" style={{ marginLeft: 4, color: "var(--danger)" }}>Đã khóa</span>}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {m.email}{m.branchName ? ` · ${m.branchName}` : ""}{m.maxPointsGrant != null ? ` · tối đa ${m.maxPointsGrant} điểm/GD` : ""}
                </div>
              </div>
              {m.role !== "BUSINESS_OWNER" && (
                <button className="ghost" onClick={() => toggle(m.id)} disabled={busyId === m.id}>
                  {busyId === m.id ? <Spinner /> : m.isActive ? <><Lock size={14} /> Khóa</> : <><Unlock size={14} /> Mở</>}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
