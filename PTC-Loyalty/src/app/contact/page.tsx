import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Liên hệ" };

export default function ContactPage() {
  return (
    <MarketingShell>
      <section className="container max-w-4xl py-16">
        <h1 className="text-4xl font-bold tracking-tight">Liên hệ</h1>
        <p className="mt-4 text-muted-foreground">
          Có câu hỏi? Đội ngũ PTC luôn sẵn sàng hỗ trợ.
        </p>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <span>hello@ptc-loyalty.example</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <span>+49 30 000 000</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <span>Berlin, Deutschland</span>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              {/* Demo form — submission is mocked. */}
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Họ tên</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Nội dung</Label>
                  <textarea id="message" name="message" rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <Button type="submit" className="w-full">Gửi tin nhắn</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingShell>
  );
}
