import { describe, it, expect } from "vitest";
import { createStaffQrToken, verifyStaffQrToken, renderStaffQrPng } from "@/lib/staff-qr";
import { createStaticQrToken } from "@/lib/qr";

const STAFF = {
  businessId: "biz_1",
  staffProfileId: "staff_1",
  secret: "secret-nonce-1",
};

describe("thẻ chấm công", () => {
  it("ký rồi kiểm lại ra đúng nội dung", () => {
    const token = createStaffQrToken(STAFF);
    const result = verifyStaffQrToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.b).toBe("biz_1");
      expect(result.payload.s).toBe("staff_1");
      expect(result.payload.n).toBe("secret-nonce-1");
    }
  });

  // Thẻ in ra giấy dùng nhiều năm, nên cùng một nhân viên phải luôn cho ra đúng
  // một chuỗi. Nếu chuỗi đổi mỗi lần sinh thì thẻ đã in sẽ chết.
  it("cùng nhân viên luôn ra cùng một chuỗi", () => {
    expect(createStaffQrToken(STAFF)).toBe(createStaffQrToken(STAFF));
  });

  it("sửa một ký tự là chữ ký hỏng", () => {
    const token = createStaffQrToken(STAFF);
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "B" : "A");
    const result = verifyStaffQrToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("đổi secret là thẻ cũ khác thẻ mới", () => {
    const oldToken = createStaffQrToken(STAFF);
    const newToken = createStaffQrToken({ ...STAFF, secret: "secret-nonce-2" });
    expect(newToken).not.toBe(oldToken);
    // Thẻ cũ vẫn đúng chữ ký; chỗ chặn nằm ở bước so secret với DB.
    const verified = verifyStaffQrToken(oldToken);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.payload.n).toBe("secret-nonce-1");
  });

  it("chuỗi rác bị từ chối", () => {
    expect(verifyStaffQrToken("khong-phai-the").ok).toBe(false);
    expect(verifyStaffQrToken("").ok).toBe(false);
  });

  // Đây là lý do thẻ nhân viên có không gian tên riêng: thẻ khách hàng ký bằng
  // CÙNG một khoá, nếu không tách thì một khách có thể chấm công.
  it("thẻ khách hàng không chấm công được", () => {
    const memberToken = createStaticQrToken({
      businessId: "biz_1",
      customerId: "cus_1",
      memberCode: "M001",
      secret: "cus-secret",
    });
    const result = verifyStaffQrToken(memberToken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("vẽ được ra ảnh PNG", async () => {
    const { dataUrl, token } = await renderStaffQrPng(STAFF);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(token).toBe(createStaffQrToken(STAFF));
  });
});
