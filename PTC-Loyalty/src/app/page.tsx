import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Gift,
  QrCode,
  ScanLine,
  Shield,
  Star,
  Store,
  Users,
  Utensils,
  Scissors,
  ShoppingBag,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/plans";
import { formatCurrency } from "@/lib/format";

const features = [
  { icon: QrCode, title: "Thẻ thành viên QR", desc: "Mỗi khách một mã QR bảo mật, có token động chống sao chép." },
  { icon: ScanLine, title: "Quét & cộng điểm", desc: "Nhân viên quét QR, nhập hóa đơn, điểm được tính tự động." },
  { icon: Gift, title: "Voucher & quà tặng", desc: "Phát hành voucher, đổi quà, chương trình sinh nhật." },
  { icon: Star, title: "Hạng thành viên", desc: "Bronze, Silver, Gold, Platinum với hệ số điểm riêng." },
  { icon: BarChart3, title: "Báo cáo thời gian thực", desc: "Doanh thu, khách quay lại, hiệu quả từng chi nhánh." },
  { icon: Shield, title: "Chống gian lận", desc: "Idempotency, giới hạn tần suất, cảnh báo bất thường." },
];

const audiences = [
  { icon: Utensils, title: "Nhà hàng & Café", desc: "1€ = 1 điểm, đổi món miễn phí, giữ chân khách quen." },
  { icon: Scissors, title: "Nail & Beauty Salon", desc: "Chương trình 10 lần tặng 1, voucher sinh nhật." },
  { icon: ShoppingBag, title: "Bán lẻ & Siêu thị", desc: "Cashback dạng điểm, đa chi nhánh, báo cáo tập trung." },
];

const steps = [
  { n: 1, title: "Đăng ký doanh nghiệp", desc: "Thiết lập thương hiệu, quy tắc tích điểm trong vài phút." },
  { n: 2, title: "Khách nhận thẻ QR", desc: "Không cần tải app — khách dùng ngay trên trình duyệt." },
  { n: 3, title: "Quét & tích điểm", desc: "Nhân viên quét QR mỗi lần mua hàng, điểm tự cộng." },
  { n: 4, title: "Đổi thưởng & quay lại", desc: "Khách đổi voucher, quà tặng và quay lại nhiều hơn." },
];

const faqs = [
  { q: "Khách hàng có cần tải ứng dụng không?", a: "Không. Khách dùng thẻ thành viên QR ngay trên trình duyệt điện thoại, có thể thêm vào màn hình chính như một PWA." },
  { q: "Dữ liệu các doanh nghiệp có tách biệt không?", a: "Có. Hệ thống là multi-tenant, mọi truy vấn được kiểm tra businessId ở phía server. Doanh nghiệp không thể xem dữ liệu của nhau." },
  { q: "Có hỗ trợ nhiều chi nhánh và nhân viên không?", a: "Có. Bạn có thể tạo nhiều chi nhánh, phân quyền nhân viên và xem báo cáo theo từng chi nhánh." },
  { q: "Thanh toán và tiền tệ như thế nào?", a: "Mặc định EUR (€), múi giờ Europe/Berlin, định dạng ngày tháng theo chuẩn Đức. Tích hợp Stripe sẵn sàng." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="container relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              🇩🇪 Dành cho doanh nghiệp Việt tại Đức
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Giữ chân khách hàng với{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                điểm thưởng & QR
              </span>
            </h1>
            <p className="mt-6 text-balance text-lg text-muted-foreground">
              Nền tảng tích điểm, voucher và thẻ thành viên QR cho nhà hàng,
              salon và cửa hàng. Khách không cần tải app. Multi-tenant, bảo mật,
              sẵn sàng thương mại.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Bắt đầu miễn phí <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/business/pho-hanoi">Xem demo doanh nghiệp</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              14 ngày dùng thử · Không cần thẻ tín dụng
            </p>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y bg-muted/30">
        <div className="container grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
          {[
            { icon: Store, k: "Multi-tenant", v: "Dữ liệu tách biệt" },
            { icon: Users, k: "Không cần app", v: "Khách dùng ngay" },
            { icon: Shield, k: "GDPR", v: "Chuẩn EU" },
            { icon: BarChart3, k: "Realtime", v: "Báo cáo trực tiếp" },
          ].map((s) => (
            <div key={s.k} className="flex items-center gap-3">
              <s.icon className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold">{s.k}</div>
                <div className="text-sm text-muted-foreground">{s.v}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Mọi thứ để vận hành chương trình khách hàng thân thiết
          </h2>
          <p className="mt-4 text-muted-foreground">
            Từ tích điểm đến báo cáo — một hệ thống duy nhất, dễ dùng cho cả chủ
            quán lẫn nhân viên.
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

      {/* How it works */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Cách hoạt động
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Phù hợp với ngành của bạn
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {audiences.map((a) => (
            <Card key={a.title} className="overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent" />
              <CardContent className="pt-6">
                <a.icon className="h-8 w-8 text-accent" />
                <h3 className="mt-4 text-lg font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{a.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y bg-muted/30 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Bảng giá đơn giản
            </h2>
            <p className="mt-4 text-muted-foreground">
              Chọn gói phù hợp. Nâng cấp bất cứ lúc nào.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <Card
                key={p.tier}
                className={p.highlighted ? "border-primary shadow-lg ring-1 ring-primary" : ""}
              >
                <CardContent className="pt-6">
                  {p.highlighted && (
                    <Badge className="mb-3">Phổ biến nhất</Badge>
                  )}
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.tagline}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {formatCurrency(p.priceMonthly)}
                    </span>
                    <span className="text-muted-foreground">/tháng</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    <li className="font-medium">{p.limits.branches}</li>
                    <li className="font-medium">{p.limits.staff}</li>
                    <li className="font-medium">{p.limits.customers}</li>
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={p.highlighted ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/register">Chọn {p.name}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Câu hỏi thường gặp
          </h2>
          <div className="mt-10 space-y-4">
            {faqs.map((f) => (
              <Card key={f.q}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent px-8 py-16 text-center text-white">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Sẵn sàng giữ chân khách hàng?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Bắt đầu miễn phí hôm nay. Thiết lập trong vài phút, không cần thẻ tín
            dụng.
          </p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link href="/register">
              Tạo tài khoản doanh nghiệp <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
