import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Cog,
  ExternalLink,
  Gift,
  Megaphone,
  Monitor,
  Palette,
  PanelTop,
  Printer,
  QrCode,
  ScanLine,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Utensils,
  Scissors,
  ShoppingBag,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLANS } from "@/lib/plans";
import { formatCurrency } from "@/lib/format";
import { MEDIA } from "@/config/marketing-media";

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
    img: MEDIA.industry.restaurant,
  },
  {
    icon: Scissors,
    title: "Nail & Beauty Salon",
    desc: "Chương trình 10 lần tặng 1, voucher sinh nhật.",
    img: MEDIA.industry.beauty,
  },
  {
    icon: ShoppingBag,
    title: "Bán lẻ & Siêu thị",
    desc: "Cashback dạng điểm, đa chi nhánh, báo cáo tập trung.",
    img: MEDIA.industry.retail,
  },
];

/** Sáu dịch vụ của PTC Creative — phần quảng bá chéo trên trang này. */
const services = [
  {
    icon: Cog,
    name: "CNC",
    vi: "Cắt CNC",
    desc: "Chữ nổi, mica, gỗ, kim loại — cắt chính xác theo bản vẽ.",
    img: MEDIA.service.cnc,
  },
  {
    icon: PanelTop,
    name: "Werbetechnik",
    vi: "Biển hiệu & quảng cáo",
    desc: "Biển mặt tiền, hộp đèn, decal, film dán kính, thi công trọn gói.",
    img: MEDIA.service.werbetechnik,
  },
  {
    icon: Printer,
    name: "Druck",
    vi: "In ấn",
    desc: "Menu, tờ rơi, catalogue, bao bì — offset và kỹ thuật số.",
    img: MEDIA.service.druck,
  },
  {
    icon: Palette,
    name: "Branding",
    vi: "Nhận diện thương hiệu",
    desc: "Logo, bộ nhận diện, ấn phẩm và ứng dụng thương hiệu đồng bộ.",
    img: MEDIA.service.branding,
  },
  {
    icon: Monitor,
    name: "Web",
    vi: "Website",
    desc: "Website, landing page, hệ thống đặt bàn và đặt hàng online.",
    img: MEDIA.service.web,
  },
  {
    icon: Megaphone,
    name: "Digital Marketing",
    vi: "Quảng cáo số",
    desc: "Google & Meta Ads, SEO địa phương, nội dung mạng xã hội.",
    img: MEDIA.service.marketing,
  },
];

const works = [
  { title: "Thi công biển hiệu", desc: "Mặt tiền nhà hàng, Berlin", img: MEDIA.work.signage },
  { title: "In ấn ấn phẩm", desc: "Menu & bao bì mang đi", img: MEDIA.work.print },
  { title: "Bộ nhận diện", desc: "Logo, danh thiếp, đồng phục", img: MEDIA.work.brandkit },
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
  { q: "PTC Creative làm được cả biển hiệu và in ấn chứ?", a: "Có. Ngoài phần mềm tích điểm, PTC Creative làm CNC, biển hiệu, in ấn, nhận diện thương hiệu, website và quảng cáo số — một đầu mối cho cả thương hiệu." },
  { q: "Thanh toán và tiền tệ như thế nào?", a: "Mặc định EUR (€), múi giờ Europe/Berlin, định dạng ngày tháng theo chuẩn Đức. Tích hợp Stripe sẵn sàng." },
];

/** Nhãn chỉ mục "01 — TIÊU ĐỀ" bằng vàng, mô-típ của bộ collateral PTC. */
function Index({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="ptc-index flex items-center justify-center gap-3 uppercase">
      <span>{n}</span>
      <span className="h-px w-8 bg-[hsl(var(--gold))]" />
      <span>{children}</span>
    </p>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* ── 01 · Hero ─────────────────────────────────────────────────────── */}
      <section className="ptc-deep relative overflow-hidden">
        <div className="ptc-dots pointer-events-none absolute inset-0 opacity-60" />
        {/* nêm cobalt chéo cắt ngang khối — mô-típ slab của PTC */}
        <div
          className="pointer-events-none absolute -bottom-1 left-0 h-40 w-2/3 bg-primary/10"
          style={{ clipPath: "polygon(0 100%, 100% 100%, 0 0)" }}
        />

        {/* Khối hero dùng `.ptc-rise` (CSS) chứ KHÔNG dùng <Reveal>: framer-motion
            `whileInView` không chạy khi tab ở chế độ nền, khiến tiêu đề trên màn
            hình đầu kẹt ở opacity 0. Xem ghi chú ở globals.css. */}
        <div className="container relative grid items-center gap-14 py-20 md:py-28 lg:grid-cols-2">
          <div className="ptc-rise">
            <p className="ptc-index uppercase">01 — Nền tảng khách hàng thân thiết</p>

            <h1 className="ptc-display mt-5 text-balance text-4xl font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Giữ chân khách hàng bằng điểm thưởng &amp; mã QR
            </h1>

            <div className="ptc-rule-gold mt-7 max-w-xs" />

            <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-white/70">
              Nền tảng tích điểm, voucher và thẻ thành viên QR cho nhà hàng, salon
              và cửa hàng của người Việt tại Đức. Khách không cần tải app.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="shadow-lg shadow-primary/30">
                <Link href="/register">
                  Bắt đầu miễn phí <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#ptc-creative">Dịch vụ PTC Creative</Link>
              </Button>
            </div>

            <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/60">
              <Check className="h-4 w-4 text-[hsl(var(--gold-hi))]" /> 14 ngày dùng thử
              <span className="text-white/25">·</span>
              <Check className="h-4 w-4 text-[hsl(var(--gold-hi))]" /> Không cần thẻ tín dụng
            </p>
          </div>

          <div className="ptc-rise-2 relative">
            <HeroVisual />
          </div>
        </div>

        {/* Dải số liệu nằm trong khối navy, ngăn bằng nét vàng */}
        <div className="ptc-rule-gold" />
        <div className="container relative grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.k} className="ptc-rise-2 text-center">
              <div className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{s.v}</div>
              <div className="mt-1 text-sm text-white/55">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 02 · Tính năng ────────────────────────────────────────────────── */}
      <section id="features" className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Index n="02">Tính năng</Index>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
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
                  <div className="ptc-badge mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:scale-110">
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

      {/* ── 03 · Cách hoạt động ───────────────────────────────────────────── */}
      <section className="border-y bg-muted/30 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Index n="03">Cách hoạt động</Index>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Bắt đầu chỉ trong 4 bước
            </h2>
          </Reveal>

          <div className="relative mt-16">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold))] to-transparent md:block" />
            <div className="grid gap-10 md:grid-cols-4">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.1} className="relative text-center md:text-left">
                  <div className="ptc-badge mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold text-white ring-4 ring-background md:mx-0">
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

      {/* ── 04 · Ngành nghề ───────────────────────────────────────────────── */}
      <section className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Index n="04">Ngành nghề</Index>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Phù hợp với ngành của bạn
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.1}>
              <Card className="group h-full overflow-hidden border-border/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div
                  className="relative h-48 bg-[hsl(var(--navy))] bg-cover bg-center"
                  style={{ backgroundImage: `url(${a.img})` }}
                >
                  {/* chỉ tối ở mép dưới để chữ đọc được — không phủ mờ lên ảnh */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="ptc-badge absolute bottom-3 left-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:scale-110">
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

      {/* ── 05 · PTC Creative ─────────────────────────────────────────────── */}
      <section id="ptc-creative" className="ptc-deep relative overflow-hidden py-24">
        <div className="ptc-dots pointer-events-none absolute inset-0 opacity-50" />
        <div
          className="pointer-events-none absolute right-0 top-0 h-56 w-1/2 bg-primary/10"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
        />

        <div className="container relative">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Index n="05">PTC Creative</Index>
            <h2 className="ptc-display mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Không chỉ phần mềm — cả thương hiệu của bạn
            </h2>
            <p className="mt-5 text-balance leading-relaxed text-white/70">
              PTC Creative là xưởng thiết kế, sản xuất và công nghệ tại Berlin.
              Từ tấm biển trước cửa, cuốn menu trên bàn, tới website và chiến dịch
              quảng cáo — cùng một đầu mối, cùng một bộ nhận diện.
            </p>

            {/* Khẩu hiệu, ngăn bằng dấu chấm vàng */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold uppercase tracking-[0.3em] text-white/85">
              {["Design", "Print", "Build", "Grow"].map((w, i) => (
                <span key={w} className="flex items-center gap-4">
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-[hsl(var(--gold-hi))]" />}
                  {w}
                </span>
              ))}
            </div>
            <div className="ptc-rule-gold mx-auto mt-8 max-w-md" />
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal key={s.name} delay={(i % 3) * 0.08}>
                <div className="ptc-glass group h-full overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1">
                  <div
                    className="relative h-40 bg-[hsl(var(--navy))] bg-cover bg-center"
                    style={{ backgroundImage: `url(${s.img})` }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(var(--navy))] to-transparent" />
                    <div className="ptc-badge absolute bottom-3 left-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:scale-110">
                      <s.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white">{s.name}</h3>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--gold-hi))]">
                      {s.vi}
                    </p>
                    <p className="mt-2.5 text-sm leading-relaxed text-white/65">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Dải dự án đã làm */}
          <Reveal className="mt-16">
            <div className="ptc-rule-gold mb-10" />
            <div className="grid gap-5 md:grid-cols-3">
              {works.map((w) => (
                <div
                  key={w.title}
                  className="group relative h-52 overflow-hidden rounded-xl bg-[hsl(var(--navy))] bg-cover bg-center ring-1 ring-white/10"
                  style={{ backgroundImage: `url(${w.img})` }}
                >
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <p className="font-semibold text-white">{w.title}</p>
                    <p className="text-sm text-white/60">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal className="mt-12 text-center">
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <a href="https://ptc-creative.com" target="_blank" rel="noopener noreferrer">
                Xem toàn bộ dịch vụ tại ptc-creative.com
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ── 06 · Bảng giá ─────────────────────────────────────────────────── */}
      <section id="pricing" className="border-y bg-muted/30 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Index n="06">Bảng giá</Index>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-md ring-1 ring-[hsl(var(--gold-hi))]">
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

      {/* ── 07 · FAQ ──────────────────────────────────────────────────────── */}
      <section className="container py-24">
        <Reveal className="mx-auto max-w-3xl">
          <Index n="07">Hỏi &amp; đáp</Index>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-4xl">
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

      {/* ── 08 · CTA cuối ─────────────────────────────────────────────────── */}
      <section className="container pb-24">
        <Reveal>
          <div className="ptc-deep relative overflow-hidden rounded-3xl px-6 py-16 text-center shadow-2xl shadow-primary/20 sm:px-8">
            <div className="ptc-dots pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative">
              <div className="ptc-rule-gold mx-auto mb-8 max-w-[10rem]" />
              <h2 className="ptc-display text-3xl font-extrabold sm:text-4xl">
                Sẵn sàng giữ chân khách hàng?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/70">
                Bắt đầu miễn phí hôm nay. Thiết lập trong vài phút, không cần thẻ
                tín dụng.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild className="shadow-lg shadow-primary/30">
                  <Link href="/register">
                    Tạo tài khoản doanh nghiệp <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/contact">Nói chuyện với PTC Creative</Link>
                </Button>
              </div>
              <div className="ptc-rule-gold mx-auto mt-10 max-w-[10rem]" />
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Khối hình hero: ảnh minh hoạ làm nền, tấm thẻ thành viên nổi lên trên.
 *  Ảnh thay được ở `src/config/marketing-media.ts`; tấm thẻ là JSX thuần nên
 *  luôn sắc nét và không bao giờ vỡ. */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      {/* Ảnh minh hoạ — thay ở src/config/marketing-media.ts */}
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[hsl(var(--navy-2))] bg-cover bg-center ring-1 ring-white/10"
        style={{ backgroundImage: `url(${MEDIA.hero})` }}
      >
        {/* chỉ tối dần ở đáy để tấm thẻ chồng lên vẫn tách khỏi nền */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[hsl(var(--navy))] to-transparent" />
      </div>

      {/* Tấm thẻ thành viên chồng lên mép dưới của ảnh */}
      <div className="relative -mt-24 ml-3 mr-10 rounded-2xl border border-white/15 bg-[hsl(var(--navy-2))]/92 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="ptc-badge flex h-9 w-9 items-center justify-center rounded-lg text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-white/55">Thẻ thành viên</p>
              <p className="text-sm font-semibold text-white">Phở Hà Nội Berlin</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[hsl(var(--gold-hi))] ring-1 ring-[hsl(var(--gold))]">
            <Star className="h-3 w-3" /> Gold
          </span>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div className="grid h-28 w-28 shrink-0 grid-cols-5 gap-1 rounded-xl bg-white p-2">
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
            <p className="text-xs text-white/55">Điểm hiện có</p>
            <p className="text-4xl font-extrabold tracking-tight text-white">1.240</p>
            <p className="mt-1 text-xs text-white/55">Còn 260 điểm lên Platinum</p>
            <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-3/4 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Hai chip nổi đặt HẲN ra ngoài mép ảnh/thẻ để không đè lên nội dung. */}
      <div className="ptc-glass absolute -right-5 top-8 hidden items-center gap-2 rounded-xl px-3 py-2 shadow-xl lg:flex">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/25 text-white">
          <ScanLine className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-white/55">Hôm nay</p>
          <p className="text-sm font-semibold text-white">128 lượt quét</p>
        </div>
      </div>

      <div className="ptc-glass absolute -bottom-7 right-2 hidden items-center gap-2 rounded-xl px-3 py-2 shadow-xl lg:flex">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-success/20 text-success">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-white/55">Vừa cộng</p>
          <p className="text-sm font-semibold text-white">+50 điểm</p>
        </div>
      </div>
    </div>
  );
}
