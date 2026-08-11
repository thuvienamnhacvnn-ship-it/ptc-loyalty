import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Brand } from "@/components/brand";

const groups = [
  {
    title: "Sản phẩm",
    links: [
      { href: "/features", label: "Tính năng" },
      { href: "/pricing", label: "Bảng giá" },
      { href: "/business/pho-hanoi", label: "Demo doanh nghiệp" },
      { href: "/register", label: "Đăng ký" },
    ],
  },
  {
    title: "PTC Creative",
    links: [
      { href: "/#ptc-creative", label: "Dịch vụ" },
      { href: "https://ptc-creative.com", label: "ptc-creative.com" },
      { href: "/about", label: "Về chúng tôi" },
      { href: "/contact", label: "Liên hệ" },
    ],
  },
  {
    title: "Pháp lý",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/privacy", label: "Bảo mật" },
      { href: "/terms", label: "Điều khoản" },
      { href: "/cookies", label: "Cookies" },
      { href: "/data-request", label: "Yêu cầu dữ liệu (GDPR)" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t bg-muted/30">
      <div className="ptc-rule-gold w-full" />
      <div className="container grid gap-10 py-14 md:grid-cols-5">
        <div className="space-y-4 md:col-span-2">
          <Brand size="lg" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[hsl(var(--gold-hi))]">
            Design · Print · Build · Grow
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Nền tảng khách hàng thân thiết, tích điểm và voucher cho nhà hàng,
            salon và cửa hàng của người Việt tại Đức. Không cần app, bảo mật chuẩn
            EU. Một sản phẩm của PTC Creative — xưởng thiết kế, sản xuất và công
            nghệ tại Berlin.
          </p>
          <div className="space-y-1.5 pt-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">A&amp;T VisioInvestment GmbH</p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Kranoldstraße 24,
              12621 Berlin, Deutschland
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> ptc.creative.vn@gmail.com
            </p>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="mb-4 text-sm font-semibold">{g.title}</h4>
            <ul className="space-y-2.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} A&amp;T VisioInvestment GmbH — PTC Bonus. Alle Rechte vorbehalten.</p>
          <p className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-success" />
            EUR · Europe/Berlin · DSGVO-konform
          </p>
        </div>
      </div>
    </footer>
  );
}
