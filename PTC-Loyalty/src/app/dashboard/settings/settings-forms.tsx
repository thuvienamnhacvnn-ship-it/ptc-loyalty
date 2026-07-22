"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { saveBusinessProfile, saveBranding } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  business: {
    name: string;
    slug: string;
    phone: string | null;
    addressLine: string | null;
    city: string | null;
    locale: string;
  };
  branding: { primaryColor: string; accentColor: string; logoUrl: string | null };
  readOnly: boolean;
  /** Public base URL used for SSR; the client prefers window.location.origin. */
  appBaseUrl: string;
}

export function SettingsForms({ business, branding, readOnly, appBaseUrl }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyA, setBusyA] = useState(false);
  const [busyB, setBusyB] = useState(false);
  const [copied, setCopied] = useState(false);

  // Start from the server-provided base (stable SSR), then upgrade to the real
  // browser origin on mount so the shown URL always matches the current domain.
  const [origin, setOrigin] = useState(appBaseUrl);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);
  const businessUrl = `${origin.replace(/\/$/, "")}/business/${business.slug}`;

  async function copyBusinessUrl() {
    try {
      await navigator.clipboard.writeText(businessUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Không sao chép được đường dẫn" });
    }
  }

  async function saveProfile(formData: FormData) {
    setBusyA(true);
    const result = await saveBusinessProfile({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      addressLine: String(formData.get("addressLine") ?? ""),
      city: String(formData.get("city") ?? ""),
      locale: formData.get("locale") as "vi" | "de" | "en",
    });
    setBusyA(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã lưu hồ sơ" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  async function saveBrand(formData: FormData) {
    setBusyB(true);
    const result = await saveBranding({
      primaryColor: String(formData.get("primaryColor") ?? ""),
      accentColor: String(formData.get("accentColor") ?? ""),
      logoUrl: String(formData.get("logoUrl") ?? ""),
    });
    setBusyB(false);
    toast(
      result.ok
        ? { variant: "success", title: "Đã lưu thương hiệu" }
        : { variant: "destructive", title: "Lỗi", description: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ doanh nghiệp</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Tên doanh nghiệp</Label>
              <Input id="name" name="name" defaultValue={business.name} disabled={readOnly} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Đường dẫn doanh nghiệp</Label>
              <div className="flex flex-col gap-3 rounded-md border border-input bg-muted/40 p-3 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 break-all text-sm text-foreground">
                  {businessUrl}
                </code>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyBusinessUrl}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" /> Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Sao chép
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={businessUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Mở đường dẫn
                    </a>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Đường dẫn cố định, được tạo tự động và không thể thay đổi.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">Ngôn ngữ</Label>
              <select id="locale" name="locale" defaultValue={business.locale} disabled={readOnly} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                <option value="vi">Tiếng Việt</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Điện thoại</Label>
              <Input id="phone" name="phone" defaultValue={business.phone ?? ""} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Thành phố</Label>
              <Input id="city" name="city" defaultValue={business.city ?? ""} disabled={readOnly} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="addressLine">Địa chỉ</Label>
              <Input id="addressLine" name="addressLine" defaultValue={business.addressLine ?? ""} disabled={readOnly} />
            </div>
            {!readOnly && (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busyA}>
                  {busyA && <Loader2 className="h-4 w-4 animate-spin" />}
                  Lưu hồ sơ
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thương hiệu</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveBrand} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Màu chính</Label>
              <Input id="primaryColor" name="primaryColor" type="color" defaultValue={branding.primaryColor} disabled={readOnly} className="h-10 p-1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Màu nhấn</Label>
              <Input id="accentColor" name="accentColor" type="color" defaultValue={branding.accentColor} disabled={readOnly} className="h-10 p-1" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="logoUrl">Logo (URL)</Label>
              <Input id="logoUrl" name="logoUrl" type="url" defaultValue={branding.logoUrl ?? ""} placeholder="https://..." disabled={readOnly} />
            </div>
            {!readOnly && (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busyB}>
                  {busyB && <Loader2 className="h-4 w-4 animate-spin" />}
                  Lưu thương hiệu
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
