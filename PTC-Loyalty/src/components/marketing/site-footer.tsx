import Link from "next/link";
import { Brand } from "@/components/brand";

const groups = [
  {
    title: "Sản phẩm",
    links: [
      { href: "/features", label: "Tính năng" },
      { href: "/pricing", label: "Bảng giá" },
      { href: "/business/pho-hanoi", label: "Demo" },
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
    <footer className="border-t bg-muted/30">
      <div className="container grid gap-8 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Brand />
          <p className="text-sm text-muted-foreground">
            Nền tảng khách hàng thân thiết cho doanh nghiệp Việt tại Đức. Made in
            Berlin.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="mb-3 text-sm font-semibold">{g.title}</h4>
            <ul className="space-y-2">
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
      <div className="border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} PTC Loyalty Platform. Alle Rechte vorbehalten.</p>
          <p>EUR · Europe/Berlin · DSGVO-konform</p>
        </div>
      </div>
    </footer>
  );
}
