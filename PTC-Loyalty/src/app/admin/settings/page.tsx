import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin · Cấu hình" };

const configRows = [
  { label: "Tiền tệ mặc định", value: "EUR (€)" },
  { label: "Múi giờ", value: "Europe/Berlin" },
  { label: "Ngôn ngữ mặc định", value: "Tiếng Việt" },
  { label: "Định dạng ngày", value: "TT.MM.JJJJ (Đức)" },
  { label: "QR TTL (động)", value: "60 giây" },
];

export default async function AdminSettingsPage() {
  const flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cấu hình hệ thống</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình toàn cục</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {configRows.map((r) => (
            <div key={r.label} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium">{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có feature flag nào.</p>
          ) : (
            flags.map((f) => (
              <div key={f.id} className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm">{f.key}</p>
                  {f.description && (
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  )}
                </div>
                <Badge variant={f.enabled ? "success" : "secondary"}>
                  {f.enabled ? "Bật" : "Tắt"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
