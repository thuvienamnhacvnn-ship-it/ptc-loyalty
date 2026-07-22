"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ChartPoint {
  label: string;
  earned: number;
  redeemed: number;
}

export function ActivityChart({ data }: { data: ChartPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Điểm cấp & sử dụng (14 ngày)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="earned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="redeemed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="earned"
                name="Điểm cấp"
                stroke="hsl(var(--primary))"
                fill="url(#earned)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="redeemed"
                name="Điểm dùng"
                stroke="hsl(var(--accent))"
                fill="url(#redeemed)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
