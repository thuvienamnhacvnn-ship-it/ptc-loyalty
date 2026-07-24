import { useState } from "react";
import { ShieldCheck, Layers, Settings2, Megaphone, BarChart3 } from "lucide-react";
import { StaffAdmin } from "./admin/StaffAdmin";

type AdminTab = "staff" | "tiers" | "loyalty" | "campaigns" | "reports";

const TABS: { key: AdminTab; label: string; icon: typeof ShieldCheck }[] = [
  { key: "staff", label: "Nhân viên", icon: ShieldCheck },
  { key: "tiers", label: "Hạng thành viên", icon: Layers },
  { key: "loyalty", label: "Cấu hình điểm", icon: Settings2 },
  { key: "campaigns", label: "Chiến dịch", icon: Megaphone },
  { key: "reports", label: "Báo cáo", icon: BarChart3 },
];

/** Admin hub (manager/owner only): staff, tiers, loyalty, campaigns, reports. */
export function AdminScreen() {
  const [tab, setTab] = useState<AdminTab>("staff");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="grid">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
        <ShieldCheck size={18} /> Quản trị
      </h2>

      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={tab === t.key ? "" : "ghost"}
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={() => setTab(t.key)}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "staff" ? (
        <StaffAdmin />
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Mục “{TABS.find((t) => t.key === tab)?.label}” đang được bổ sung ở bước tiếp theo.
          </p>
        </div>
      )}
    </div>
  );
}
