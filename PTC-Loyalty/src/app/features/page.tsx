import type { Metadata } from "next";
import {
  QrCode,
  ScanLine,
  Gift,
  Star,
  BarChart3,
  Shield,
  Users,
  Ticket,
  Building2,
  Megaphone,
  Bell,
  CreditCard,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tính năng" };

const features = [
  { icon: QrCode, title: "Thẻ thành viên QR", desc: "QR động ký HMAC, hết hạn sau 60s, chống sao chép." },
  { icon: ScanLine, title: "Quét & cộng điểm", desc: "Camera quét nhanh, nhập hóa đơn, tính điểm tự động." },
  { icon: Star, title: "Hạng thành viên", desc: "Bronze → Platinum với hệ số điểm, tự động thăng hạng." },
  { icon: Gift, title: "Danh mục quà", desc: "Khách đổi điểm lấy quà, quản lý tồn kho." },
  { icon: Ticket, title: "Voucher", desc: "Voucher %/cố định/tặng món, giới hạn theo khách & hạng." },
  { icon: Megaphone, title: "Chiến dịch marketing", desc: "Nhắm khách lâu chưa quay lại, hạng cao, sinh nhật." },
  { icon: BarChart3, title: "Báo cáo realtime", desc: "Biểu đồ, export CSV, hiệu quả theo chi nhánh/nhân viên." },
  { icon: Shield, title: "Chống gian lận", desc: "Idempotency, giới hạn tần suất, cảnh báo bất thường." },
  { icon: Building2, title: "Đa chi nhánh", desc: "Quản lý nhiều địa điểm, nhân viên theo chi nhánh." },
  { icon: Users, title: "Quản lý khách hàng", desc: "Tìm kiếm, import/export, điều chỉnh điểm, GDPR." },
  { icon: Bell, title: "Thông báo", desc: "Cộng điểm, đổi quà, sắp lên hạng, ưu đãi mới." },
  { icon: CreditCard, title: "Thuê bao", desc: "Gói Basic/Business/Premium, sẵn sàng Stripe." },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Tính năng đầy đủ</h1>
          <p className="mt-4 text-muted-foreground">
            Mọi công cụ bạn cần để vận hành chương trình khách hàng thân thiết chuyên nghiệp.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
