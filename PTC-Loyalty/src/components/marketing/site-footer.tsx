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
    title: "Công ty",
    links: [
      { href: "/about", label: "Về chúng tôi" },
      { href: "/contact", label: "Liên hệ" },
    ],
  },
  {
    title: "Pháp lý",
    links: [
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
      <div className="h-0.5 w-full bg-gradient-to-r from-primary via-accent to-primary opacity-70" />
      <div className="container grid gap-10 py-14 md:grid-cols-5">
        <div className="space-y-4 md:col-span-2">
          <Brand size="lg" />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Nền tảng khách hàng thân thiết, tích điểm và voucher cho nhà hàng,
            salon và cửa hàng của người Việt tại Đức. Không cần app, bảo mật chuẩn
            EU.
          </p>
          <div className="space-y-1.5 pt-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Berlin, Deutschland
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> hello@ptc-loyalty.de
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
          <p>© {new Date().getFullYear()} PTC Loyalty Platform. Alle Rechte vorbehalten.</p>
          <p className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-success" />
            EUR · Europe/Berlin · DSGVO-konform
          </p>
        </div>
      </div>
    </footer>
  );
}
