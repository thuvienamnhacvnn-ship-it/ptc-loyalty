"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Plug, PlugZap } from "lucide-react";
import { saveConnection, saveToggles, sendTest, disconnect } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  canManageConnection: boolean; // owner
  canManage: boolean; // manager+
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  phoneNumberId: string;
  wabaId: string;
  graphApiVersion: string;
  defaultLanguage: string;
  hasToken: boolean;
  notifyOnEarn: boolean;
  notifyOnRedeem: boolean;
  notifyOnVoucher: boolean;
  encryptionReady: boolean;
}

export function WhatsAppSettingsForm(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyConn, setBusyConn] = useState(false);
  const [busyToggle, setBusyToggle] = useState(false);
  const [busyTest, setBusyTest] = useState(false);

  async function onSaveConnection(formData: FormData) {
    setBusyConn(true);
    const result = await saveConnection({
      phoneNumberId: String(formData.get("phoneNumberId") ?? ""),
      wabaId: String(formData.get("wabaId") ?? ""),
      accessToken: String(formData.get("accessToken") ?? ""),
      graphApiVersion: String(formData.get("graphApiVersion") ?? ""),
      defaultLanguage: formData.get("defaultLanguage") as "vi" | "de" | "en",
    });
    setBusyConn(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã lưu kết nối WhatsApp" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  async function onSaveToggles(formData: FormData) {
    setBusyToggle(true);
    const result = await saveToggles({
      notifyOnEarn: formData.get("notifyOnEarn") === "on",
      notifyOnRedeem: formData.get("notifyOnRedeem") === "on",
      notifyOnVoucher: formData.get("notifyOnVoucher") === "on",
    });
    setBusyToggle(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã lưu tùy chọn thông báo" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  async function onSendTest(formData: FormData) {
    setBusyTest(true);
    const result = await sendTest({
      phone: String(formData.get("phone") ?? ""),
      language: formData.get("language") as "vi" | "de" | "en",
    });
    setBusyTest(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã xếp hàng gửi tin nhắn thử" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  async function onDisconnect() {
    if (!confirm("Ngắt kết nối WhatsApp? Access token sẽ bị xóa.")) return;
    const result = await disconnect();
    toast(
      result.ok
        ? { variant: "success", title: "Đã ngắt kết nối" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Connection status + credentials */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Kết nối WhatsApp</CardTitle>
          <Badge variant={props.status === "CONNECTED" ? "success" : props.status === "ERROR" ? "destructive" : "secondary"}>
            {props.status === "CONNECTED" ? "Đã kết nối" : props.status === "ERROR" ? "Lỗi" : "Chưa kết nối"}
          </Badge>
        </CardHeader>
        <CardContent>
          {!props.encryptionReady && (
            <p className="mb-4 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
              ⚠️ Server chưa có <code>ENCRYPTION_KEY</code>. Cần thiết lập để mã hóa
              access token trước khi kết nối.
            </p>
          )}
          <form action={onSaveConnection} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input id="phoneNumberId" name="phoneNumberId" defaultValue={props.phoneNumberId} disabled={!props.canManageConnection} placeholder="1099xxxxx..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
              <Input id="wabaId" name="wabaId" defaultValue={props.wabaId} disabled={!props.canManageConnection} placeholder="1029xxxxx..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="accessToken">
                Access Token {props.hasToken && <span className="text-muted-foreground">(đã lưu — để trống nếu không đổi)</span>}
              </Label>
              <Input
                id="accessToken"
                name="accessToken"
                type="password"
                autoComplete="off"
                disabled={!props.canManageConnection}
                placeholder={props.hasToken ? "••••••••••••••••" : "EAAG... (chỉ lưu ở server, được mã hóa)"}
              />
              <p className="text-xs text-muted-foreground">
                Token được mã hóa AES-256-GCM và không bao giờ gửi xuống trình duyệt.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultLanguage">Ngôn ngữ mặc định</Label>
              <select id="defaultLanguage" name="defaultLanguage" defaultValue={props.defaultLanguage} disabled={!props.canManageConnection} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                <option value="vi">Tiếng Việt</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="graphApiVersion">Graph API version</Label>
              <Input id="graphApiVersion" name="graphApiVersion" defaultValue={props.graphApiVersion} disabled={!props.canManageConnection} placeholder="v21.0" />
            </div>
            {props.canManageConnection && (
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={busyConn || !props.encryptionReady}>
                  {busyConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Lưu kết nối
                </Button>
                {props.status !== "DISCONNECTED" && (
                  <Button type="button" variant="outline" onClick={onDisconnect}>
                    <PlugZap className="h-4 w-4" /> Ngắt kết nối
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Notification toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Loại thông báo giao dịch</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onSaveToggles} className="space-y-3">
            <Toggle name="notifyOnEarn" label="Thông báo cộng điểm" defaultChecked={props.notifyOnEarn} disabled={!props.canManage} />
            <Toggle name="notifyOnRedeem" label="Thông báo đổi quà" defaultChecked={props.notifyOnRedeem} disabled={!props.canManage} />
            <Toggle name="notifyOnVoucher" label="Thông báo voucher" defaultChecked={props.notifyOnVoucher} disabled={!props.canManage} />
            {props.canManage && (
              <Button type="submit" disabled={busyToggle}>
                {busyToggle && <Loader2 className="h-4 w-4 animate-spin" />}
                Lưu tùy chọn
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Test message */}
      <Card>
        <CardHeader>
          <CardTitle>Gửi tin nhắn thử</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onSendTest} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="phone">Số WhatsApp (E.164)</Label>
              <Input id="phone" name="phone" placeholder="+49151..." disabled={props.status !== "CONNECTED"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Ngôn ngữ</Label>
              <select id="language" name="language" defaultValue={props.defaultLanguage} disabled={props.status !== "CONNECTED"} className="flex h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                <option value="vi">VI</option>
                <option value="de">DE</option>
                <option value="en">EN</option>
              </select>
            </div>
            <Button type="submit" disabled={busyTest || props.status !== "CONNECTED"}>
              {busyTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi thử
            </Button>
          </form>
          {props.status !== "CONNECTED" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Kết nối WhatsApp trước khi gửi thử. Tin nhắn văn bản chỉ gửi được
              trong cửa sổ 24 giờ của khách.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="h-4 w-4" />
      {label}
    </label>
  );
}
