import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Gift,
  QrCode,
  ScanLine,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Utensils,
  Scissors,
  ShoppingBag,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";
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
  {
    icon: Utensils,
    title: "Nhà hàng & Café",
    desc: "1€ = 1 điểm, đổi món miễn phí, giữ chân khách quen.",
    img: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=60",
  },
  {
    icon: Scissors,
    title: "Nail & Beauty Salon",
    desc: "Chương trình 10 lần tặng 1, voucher sinh nhật.",
    img: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=60",
  },
  {
    icon: ShoppingBag,
    title: "Bán lẻ & Siêu thị",
    desc: "Cashback dạng điểm, đa chi nhánh, báo cáo tập trung.",
    img: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=800&q=60",
  },
];

const steps = [
  { n: 1, title: "Đăng ký doanh nghiệp", desc: "Thiết lập thương hiệu, quy tắc tích điểm trong vài phút." },
  { n: 2, title: "Khách nhận thẻ QR", desc: "Không cần tải app — khách dùng ngay trên trình duyệt." },
  { n: 3, title: "Quét & tích điểm", desc: "Nhân viên quét QR mỗi lần mua hàng, điểm tự cộng." },
  { n: 4, title: "Đổi thưởng & quay lại", desc: "Khách đổi voucher, quà tặng và quay lại nhiều hơn." },
];

const stats = [
  { v: "+35%", k: "Khách quay lại" },
  { v: "0", k: "App cần tải" },
  { v: "<60s", k: "Cộng điểm / khách" },
  { v: "100%", k: "Dữ liệu tách biệt" },
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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* layered gradient mesh background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.16),transparent_60%)]" />
          <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -right-32 top-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000,transparent)]" />
        </div>

        <div className="container grid items-center gap-12 py-20 md:py-28 lg:grid-cols-2">
          <Reveal>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
                <Sparkles className="h-3 w-3" />
              </span>
              Dành cho doanh nghiệp Việt tại Đức 🇩🇪
            </Link>

            <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Giữ chân khách hàng với{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                điểm thưởng &amp; QR
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
              Nền tảng tích điểm, voucher và thẻ thành viên QR cho nhà hàng, salon
              và cửa hàng. Khách không cần tải app. Multi-tenant, bảo mật, sẵn sàng
              thương mại.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="shadow-lg shadow-primary/25">
                <Link href="/register">
                  Bắt đầu miễn phí <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/business/pho-hanoi">Xem demo doanh nghiệp</Link>
              </Button>
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-success" /> 14 ngày dùng thử
              <span className="text-border">·</span>
              <Check className="h-4 w-4 text-success" /> Không cần thẻ tín dụng
            </p>
          </Reveal>

          {/* Product mockup */}
          <Reveal delay={0.15} className="relative">
            <HeroMockup />
          </Reveal>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="container grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.05} className="text-center">
              <div className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
                {s.v}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.k}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">Tính năng</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Mọi thứ để vận hành chương trình khách hàng thân thiết
          </h2>
          <p className="mt-4 text-muted-foreground">
            Từ tích điểm đến báo cáo — một hệ thống duy nhất, dễ dùng cho cả chủ
            quán lẫn nhân viên.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <Card className="group h-full border-border/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary ring-1 ring-inset ring-primary/10 transition-transform duration-300 group-hover:scale-110">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works (timeline) ──────────────────────────────────────── */}
      <section className="border-y bg-muted/30 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Cách hoạt động</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Bắt đầu chỉ trong 4 bước
            </h2>
          </Reveal>

          <div className="relative mt-16">
            {/* connecting line (desktop) */}
            <div className="absolute left-0 right-0 top-7 hidden h-0.5 bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20 md:block" />
            <div className="grid gap-10 md:grid-cols-4">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.1} className="relative text-center md:text-left">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-extrabold text-white shadow-lg shadow-primary/25 ring-4 ring-background md:mx-0">
                    {s.n}
                  </div>
                  <h3 className="mt-5 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Industries ───────────────────────────────────────────────────── */}
      <section className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">Ngành nghề</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Phù hợp với ngành của bạn
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.1}>
              <Card className="group h-full overflow-hidden border-border/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                {/* photo header with brand-gradient fallback (shows if image fails) */}
                <div
                  className="relative h-44 bg-gradient-to-br from-primary via-primary to-accent bg-cover bg-center"
                  style={{ backgroundImage: `url(${a.img})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-primary shadow-md backdrop-blur transition-transform duration-300 group-hover:scale-110">
                    <a.icon className="h-5 w-5" />
                  </div>
                </div>
                <CardContent className="pt-5">
                  <h3 className="text-lg font-semibold">{a.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-y bg-muted/30 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Bảng giá</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Bảng giá đơn giản, minh bạch
            </h2>
            <p className="mt-4 text-muted-foreground">
              Chọn gói phù hợp. Nâng cấp bất cứ lúc nào. Không phí ẩn.
            </p>
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-5xl items-center gap-6 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.tier} delay={i * 0.08}>
                <Card
                  className={
                    p.highlighted
                      ? "relative border-primary bg-card shadow-2xl shadow-primary/15 ring-2 ring-primary md:scale-[1.05]"
                      : "h-full border-border/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  }
                >
                  {p.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-white shadow-md">
                        <TrendingUp className="h-3 w-3" /> Phổ biến nhất
                      </span>
                    </div>
                  )}
                  <CardContent className="pt-8">
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                    <div className="mt-5 flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {formatCurrency(p.priceMonthly)}
                      </span>
                      <span className="pb-1 text-muted-foreground">/tháng</span>
                    </div>
                    <ul className="mt-6 space-y-2.5 text-sm">
                      <li className="font-medium">{p.limits.branches}</li>
                      <li className="font-medium">{p.limits.staff}</li>
                      <li className="font-medium">{p.limits.customers}</li>
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                            <Check className="h-3 w-3" />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={p.highlighted ? "mt-8 w-full shadow-lg shadow-primary/25" : "mt-8 w-full"}
                      variant={p.highlighted ? "default" : "outline"}
                      asChild
                    >
                      <Link href="/register">Chọn {p.name}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="container py-24">
        <Reveal className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Câu hỏi thường gặp
          </h2>
          <div className="mt-12 space-y-4">
            {faqs.map((f) => (
              <Card key={f.q} className="border-border/70 transition-colors hover:border-primary/30">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="container pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent px-6 py-16 text-center text-white shadow-2xl shadow-primary/20 sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.12),transparent_40%)]" />
            <div className="relative">
              <h2 className="text-3xl font-bold sm:text-4xl">Sẵn sàng giữ chân khách hàng?</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/90">
                Bắt đầu miễn phí hôm nay. Thiết lập trong vài phút, không cần thẻ
                tín dụng.
              </p>
              <Button size="lg" variant="secondary" className="mt-8 shadow-lg" asChild>
                <Link href="/register">
                  Tạo tài khoản doanh nghiệp <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Inline product mockup for the hero — a member QR card with floating stat
 *  chips. Pure JSX/CSS so it never breaks and stays crisp on every screen. */
function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* glow */}
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/30 to-accent/30 blur-2xl" />

      {/* member card */}
      <div className="rounded-3xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Thẻ thành viên</p>
              <p className="text-sm font-semibold">Phở Hà Nội Berlin</p>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white hover:opacity-90">
            <Star className="mr-1 h-3 w-3" /> Gold
          </Badge>
        </div>

        {/* QR + points */}
        <div className="mt-6 flex items-center gap-5">
          <div className="grid h-28 w-28 shrink-0 grid-cols-5 gap-1 rounded-xl border bg-white p-2">
            {Array.from({ length: 25 }).map((_, i) => (
              <span
                key={i}
                className={`rounded-[2px] ${
                  [0, 1, 2, 4, 5, 8, 10, 12, 14, 16, 18, 20, 21, 22, 24, 6, 3, 19, 9].includes(i)
                    ? "bg-slate-900"
                    : "bg-transparent"
                }`}
              />
            ))}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Điểm hiện có</p>
            <p className="bg-gradient-to-r from-primary to-accent bg-clip-text text-4xl font-extrabold text-transparent">
              1.240
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Còn 260 điểm lên Platinum</p>
            <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
          </div>
        </div>
      </div>

      {/* floating chip: points earned */}
      <div className="absolute -left-4 -bottom-6 hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-xl sm:flex">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Vừa cộng</p>
          <p className="text-sm font-semibold">+50 điểm</p>
        </div>
      </div>

      {/* floating chip: scans today */}
      <div className="absolute -right-4 -top-5 hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-xl sm:flex">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ScanLine className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Hôm nay</p>
          <p className="text-sm font-semibold">128 lượt quét</p>
        </div>
      </div>
    </div>
  );
}
