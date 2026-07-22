import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Về chúng tôi" };

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="container max-w-3xl py-16">
        <h1 className="text-4xl font-bold tracking-tight">Về PTC Loyalty</h1>
        <div className="mt-8 space-y-4 text-muted-foreground">
          <p>
            PTC Loyalty Platform được xây dựng dành riêng cho cộng đồng doanh nghiệp
            Việt Nam tại Đức: nhà hàng, quán café, nail & beauty salon, cửa hàng bán
            lẻ và trung tâm dịch vụ.
          </p>
          <p>
            Chúng tôi tin rằng mọi doanh nghiệp nhỏ đều xứng đáng có công cụ giữ chân
            khách hàng chuyên nghiệp như các chuỗi lớn — mà không cần đầu tư phần cứng
            hay bắt khách tải ứng dụng.
          </p>
          <p>
            Nền tảng được thiết kế theo chuẩn multi-tenant SaaS, tuân thủ DSGVO/GDPR,
            mặc định EUR và múi giờ Europe/Berlin, hỗ trợ tiếng Việt, tiếng Đức và
            tiếng Anh.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
