import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Chính sách Cookie" };

export default function CookiesPage() {
  return (
    <LegalPage title="Chính sách Cookie" updated="21.07.2026">
      <p>
        Chúng tôi sử dụng cookie ở mức tối thiểu để vận hành nền tảng.
      </p>
      <h2>Cookie thiết yếu</h2>
      <p>
        Cookie phiên đăng nhập (session) là bắt buộc để duy trì trạng thái đăng nhập
        an toàn. Không thể tắt các cookie này nếu muốn sử dụng dịch vụ.
      </p>
      <h2>Cookie tùy chọn</h2>
      <p>
        Cookie ghi nhớ giao diện sáng/tối. Không có cookie theo dõi/quảng cáo của
        bên thứ ba trong bản demo này.
      </p>
    </LegalPage>
  );
}
