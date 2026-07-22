import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Điều khoản dịch vụ" };

export default function TermsPage() {
  return (
    <LegalPage title="Điều khoản dịch vụ" updated="21.07.2026">
      <p>
        Bằng việc sử dụng PTC Loyalty Platform, bạn đồng ý với các điều khoản dưới
        đây.
      </p>
      <h2>1. Tài khoản</h2>
      <p>
        Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động dưới tài
        khoản của mình.
      </p>
      <h2>2. Sử dụng hợp lệ</h2>
      <p>
        Không được dùng nền tảng cho mục đích gian lận, thao túng điểm thưởng hoặc
        vi phạm pháp luật. Chúng tôi có quyền khóa tài khoản vi phạm.
      </p>
      <h2>3. Thuê bao</h2>
      <p>
        Các gói dịch vụ được tính theo tháng. Bản dùng thử kéo dài 14 ngày. Bạn có
        thể hủy bất cứ lúc nào.
      </p>
      <h2>4. Giới hạn trách nhiệm</h2>
      <p>
        Dịch vụ được cung cấp &quot;nguyên trạng&quot;. Đây là phiên bản demo phục vụ
        trình diễn sản phẩm.
      </p>
    </LegalPage>
  );
}
