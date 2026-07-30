"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, QrCode, PlugZap, RefreshCw } from "lucide-react";
import {
  connectWhatsApp,
  disconnect,
  pollConnection,
  saveSettings,
  sendTest,
  type ConnectionResult,
} from "./actions";
import type { ConnectionView } from "@/lib/whatsapp/connection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  canManageConnection: boolean; // owner
  canManage: boolean; // manager+
  connection: ConnectionView;
  defaultLanguage: string;
  notifyOnSignup: boolean;
  notifyOnEarn: boolean;
  notifyOnRedeem: boolean;
  notifyOnVoucher: boolean;
}

/** Poll interval while a login QR is on screen. */
const POLL_MS = 3000;

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Đã kết nối",
  QR_PENDING: "Chờ quét mã",
  CONNECTING: "Đang kết nối",
  ERROR: "Lỗi",
  DISCONNECTED: "Chưa kết nối",
};

function statusVariant(status: string) {
  if (status === "CONNECTED") return "success" as const;
  if (status === "ERROR") return "destructive" as const;
  return "secondary" as const;
}

export function WhatsAppSettingsForm(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [conn, setConn] = useState<ConnectionView>(props.connection);
  const [busyConn, setBusyConn] = useState(false);
  const [busySettings, setBusySettings] = useState(false);
  const [busyTest, setBusyTest] = useState(false);

  const connected = conn.status === "CONNECTED";
  const waiting = conn.status === "QR_PENDING" || conn.status === "CONNECTING";

  const apply = useCallback(
    (result: ConnectionResult, onError?: string) => {
      if (result.ok) {
        setConn(result.connection);
        return true;
      }
      toast({ variant: "destructive", title: onError ?? "Lỗi", description: result.error });
      return false;
    },
    [toast],
  );

  const wasConnected = useRef(connected);

  // The server component renders the stored state; ask the provider once on
  // mount so a session that dropped in the meantime shows up as disconnected.
  useEffect(() => {
    let cancelled = false;
    void pollConnection().then((result) => {
      if (!cancelled && result.ok) {
        setConn(result.connection);
        wasConnected.current = result.connection.status === "CONNECTED";
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // While pairing, keep asking for the live session state. The QR is rotated
  // server-side once it expires, so the owner never scans a dead code.
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const result = await pollConnection();
      if (cancelled || !result.ok) return;
      setConn(result.connection);
      if (result.connection.status === "CONNECTED" && !wasConnected.current) {
        wasConnected.current = true;
        toast({
          variant: "success",
          title: "Đã kết nối WhatsApp",
          description: result.connection.phoneNumber
            ? `Số gửi tin: +${result.connection.phoneNumber}`
            : undefined,
        });
        router.refresh();
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [waiting, router, toast]);

  async function onConnect() {
    setBusyConn(true);
    const result = await connectWhatsApp();
    setBusyConn(false);
    if (apply(result) && result.ok && result.connection.status === "ERROR") {
      toast({
        variant: "destructive",
        title: "Không lấy được mã QR",
        description:
          result.connection.error === "provider_not_configured"
            ? "Máy chủ chưa cấu hình WhatsApp gateway (EVOLUTION_API_URL / EVOLUTION_API_KEY)."
            : result.connection.error ?? undefined,
      });
    }
  }

  async function onDisconnect() {
    if (!confirm("Ngắt kết nối WhatsApp? Bạn sẽ phải quét lại mã QR để gửi tin.")) return;
    setBusyConn(true);
    const result = await disconnect();
    setBusyConn(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã ngắt kết nối" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) {
      wasConnected.current = false;
      router.refresh();
    }
  }

  async function onSaveSettings(formData: FormData) {
    setBusySettings(true);
    const result = await saveSettings({
      defaultLanguage: formData.get("defaultLanguage") as "vi" | "de" | "en",
      notifyOnSignup: formData.get("notifyOnSignup") === "on",
      notifyOnEarn: formData.get("notifyOnEarn") === "on",
      notifyOnRedeem: formData.get("notifyOnRedeem") === "on",
      notifyOnVoucher: formData.get("notifyOnVoucher") === "on",
    });
    setBusySettings(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã lưu tùy chọn" }
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

  return (
    <div className="space-y-6">
      {/* Pairing: scan the login QR with the restaurant's own phone */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Kết nối WhatsApp của nhà hàng</CardTitle>
          <Badge variant={statusVariant(conn.status)}>
            {STATUS_LABEL[conn.status] ?? conn.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <p className="font-medium">
                  Tin nhắn gửi tới khách từ số{" "}
                  <span className="font-mono">
                    {conn.phoneNumber ? `+${conn.phoneNumber}` : "của nhà hàng"}
                  </span>
                  {conn.profileName ? ` (${conn.profileName})` : ""}.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Khách sẽ thấy người gửi chính là nhà hàng, không phải PTC-BONUS.
                </p>
              </div>
              {props.canManageConnection && (
                <Button type="button" variant="outline" onClick={onDisconnect} disabled={busyConn}>
                  {busyConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Ngắt kết nối
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-1 text-sm text-muted-foreground">
                <li>1. Bấm “Kết nối WhatsApp” để lấy mã QR đăng nhập.</li>
                <li>
                  2. Mở WhatsApp trên điện thoại của nhà hàng → <b>Cài đặt</b> →{" "}
                  <b>Thiết bị đã liên kết</b> → <b>Liên kết thiết bị</b>.
                </li>
                <li>3. Quét mã QR bên dưới. Không cần Meta Business, không cần xác minh doanh nghiệp.</li>
              </ol>

              {conn.qrDataUrl && (
                <div className="flex flex-col items-center gap-2 rounded-md border p-4">
                  {/* Provider-issued data URL — rendered unoptimised on purpose. */}
                  <Image
                    src={conn.qrDataUrl}
                    alt="Mã QR đăng nhập WhatsApp"
                    width={256}
                    height={256}
                    unoptimized
                    className="h-64 w-64"
                  />
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Mã tự làm mới cho tới khi bạn quét xong.
                  </p>
                  {conn.pairingCode && (
                    <p className="text-xs text-muted-foreground">
                      Hoặc nhập mã ghép nối: <span className="font-mono">{conn.pairingCode}</span>
                    </p>
                  )}
                </div>
              )}

              {conn.status === "ERROR" && conn.error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {conn.error === "provider_not_configured"
                    ? "Máy chủ chưa cấu hình WhatsApp gateway. Đặt EVOLUTION_API_URL và EVOLUTION_API_KEY rồi thử lại."
                    : conn.error}
                </p>
              )}

              {props.canManageConnection ? (
                <Button type="button" onClick={onConnect} disabled={busyConn}>
                  {busyConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  {conn.qrDataUrl ? "Lấy mã QR mới" : "Kết nối WhatsApp"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chỉ chủ doanh nghiệp mới kết nối được WhatsApp.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Kênh gửi: {conn.providerLabel}
          </p>
        </CardContent>
      </Card>

      {/* Language + per-event toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Tin nhắn tự động</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onSaveSettings} className="space-y-4">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="defaultLanguage">Ngôn ngữ mặc định</Label>
              <select
                id="defaultLanguage"
                name="defaultLanguage"
                defaultValue={props.defaultLanguage}
                disabled={!props.canManage}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-3">
              <Toggle name="notifyOnSignup" label="Gửi lời chào + thẻ QR khi đăng ký thành viên" defaultChecked={props.notifyOnSignup} disabled={!props.canManage} />
              <Toggle name="notifyOnEarn" label="Thông báo cộng điểm" defaultChecked={props.notifyOnEarn} disabled={!props.canManage} />
              <Toggle name="notifyOnRedeem" label="Thông báo đổi quà" defaultChecked={props.notifyOnRedeem} disabled={!props.canManage} />
              <Toggle name="notifyOnVoucher" label="Thông báo voucher" defaultChecked={props.notifyOnVoucher} disabled={!props.canManage} />
            </div>
            {props.canManage && (
              <Button type="submit" disabled={busySettings}>
                {busySettings && <Loader2 className="h-4 w-4 animate-spin" />}
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
              <Label htmlFor="phone">Số WhatsApp người nhận</Label>
              <Input id="phone" name="phone" placeholder="+49151..." disabled={!connected} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Ngôn ngữ</Label>
              <select
                id="language"
                name="language"
                defaultValue={props.defaultLanguage}
                disabled={!connected}
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="vi">VI</option>
                <option value="de">DE</option>
                <option value="en">EN</option>
              </select>
            </div>
            <Button type="submit" disabled={busyTest || !connected}>
              {busyTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi thử
            </Button>
          </form>
          {!connected && (
            <p className="mt-2 text-xs text-muted-foreground">
              Quét mã QR để kết nối số WhatsApp của nhà hàng trước khi gửi thử.
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
