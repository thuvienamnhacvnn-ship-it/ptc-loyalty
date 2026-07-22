import { MapPin } from "lucide-react";
import { useSession } from "../state/SessionContext";

export function BranchSelectScreen() {
  const { session, setBranch, setPhase } = useSession();
  if (!session) return null;

  function choose(id: string) {
    setBranch(id);
    setPhase("pos");
  }

  return (
    <div className="center">
      <div className="card" style={{ width: 440 }}>
        <h2>Chọn chi nhánh làm việc</h2>
        <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>
          Tài khoản của bạn thuộc nhiều chi nhánh. Chọn nơi đang bán hàng.
        </p>
        <div className="grid" style={{ marginTop: 12 }}>
          {session.branches.map((b) => (
            <button
              key={b.id}
              className="ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-start",
                padding: 16,
              }}
              onClick={() => choose(b.id)}
            >
              <MapPin size={18} color="var(--primary)" /> {b.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
