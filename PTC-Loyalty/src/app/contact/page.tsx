import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "./contact-form";

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
              <span>ptc.creative.vn@gmail.com</span>
            </div>
            {/*
              Hotline khách hàng của PTC Creative, cũng là số WhatsApp
              (wa.me/4915223758632). KHÁC số trong Impressum (+49 152 37376688)
              một cách CỐ Ý: số kia là số pháp lý của pháp nhân. Đừng gộp làm một.
            */}
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <span>0152 23758632</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <span>Kranoldstraße 24, 12621 Berlin</span>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              <ContactForm />
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingShell>
  );
}
