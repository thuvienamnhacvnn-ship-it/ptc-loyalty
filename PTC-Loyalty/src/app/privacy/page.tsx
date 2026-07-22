import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Chính sách bảo mật" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Chính sách bảo mật (DSGVO/GDPR)" updated="21.07.2026">
      <p>
        PTC Loyalty Platform tôn trọng quyền riêng tư của bạn và tuân thủ Quy định
        chung về bảo vệ dữ liệu của EU (DSGVO/GDPR).
      </p>
      <h2>1. Dữ liệu chúng tôi thu thập</h2>
      <p>
        Chúng tôi chỉ thu thập dữ liệu cần thiết cho chương trình khách hàng thân
        thiết: họ tên, email, số điện thoại (tùy chọn), lịch sử giao dịch điểm và
        tùy chọn nhận marketing. Chúng tôi <strong>không</strong> thu thập dữ liệu
        nhạy cảm không cần thiết.
      </p>
      <h2>2. Mục đích sử dụng</h2>
      <p>
        Dữ liệu được dùng để vận hành tích điểm, đổi thưởng, và (nếu bạn đồng ý)
        gửi ưu đãi. Mỗi doanh nghiệp chỉ truy cập dữ liệu khách hàng của chính họ
        (kiến trúc multi-tenant, cách ly ở tầng máy chủ).
      </p>
      <h2>3. Quyền của bạn</h2>
      <p>
        Bạn có quyền truy cập, chỉnh sửa, xuất và yêu cầu xóa/ẩn danh dữ liệu của
        mình bất cứ lúc nào qua trang <strong>/data-request</strong> hoặc trong hồ
        sơ thành viên.
      </p>
      <h2>4. Bảo mật</h2>
      <p>
        Mật khẩu được băm (bcrypt), dữ liệu truyền qua HTTPS, mã QR được ký HMAC và
        hết hạn nhanh. Mọi thao tác điều chỉnh điểm được ghi vào nhật ký kiểm toán.
      </p>
      <h2>5. Lưu trữ</h2>
      <p>
        Dữ liệu được lưu trữ trong EU. Khi bạn yêu cầu xóa, dữ liệu cá nhân sẽ được
        ẩn danh trong khi vẫn giữ số liệu tổng hợp phi định danh.
      </p>
    </LegalPage>
  );
}
