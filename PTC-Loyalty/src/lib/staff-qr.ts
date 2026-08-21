import crypto from "crypto";
import QRCode from "qrcode";

/**
 * Thẻ chấm công của nhân viên.
 *
 * Cố ý TÁCH khỏi `qr.ts` (thẻ khách hàng) dù cách ký giống hệt: hai loại thẻ
 * cùng ký bằng một khoá nhưng khác không gian tên, nên một thẻ khách hàng
 * KHÔNG BAO GIỜ chấm công được và ngược lại. Ghép chung một hàm verify rồi
 * phân biệt bằng field trong payload là kiểu bảo mật "nhớ mà kiểm" — chỉ cần
 * quên một chỗ là thủng. Ở đây tiền tố `v` nằm ngay trong chuỗi được ký nên
 * chữ ký của bên này không dùng lại được cho bên kia.
 *
 * Thẻ là TĨNH và in ra giấy: cùng một nhân viên luôn cho ra đúng một chuỗi, để
 * thẻ nhựa in một lần dùng nhiều năm. Bù lại nó không hết hạn, nên cách thu hồi
 * duy nhất là đổi `StaffProfile.qrSecret` — làm mất thẻ thì đổi secret là thẻ
 * cũ chết ngay.
 */

const NAMESPACE = "ptcstaff.v1";

export interface StaffQrPayload {
  v: typeof NAMESPACE;
  b: string; // businessId
  s: string; // staffProfileId
  n: string; // qrSecret — đổi giá trị này là thu hồi thẻ
}

function getSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("QR_SIGNING_SECRET is missing or too short. Set it in your environment.");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64: string): string {
  // Tiền tố không gian tên nằm TRONG chuỗi được ký, nên chữ ký của thẻ khách
  // hàng không thể dùng lại cho thẻ nhân viên kể cả khi chung khoá.
  return b64url(
    crypto.createHmac("sha256", getSecret()).update(`${NAMESPACE}.${payloadB64}`).digest(),
  );
}

/** Sinh chuỗi thẻ chấm công (cố định theo nhân viên). */
export function createStaffQrToken(data: {
  businessId: string;
  staffProfileId: string;
  secret: string;
}): string {
  const payload: StaffQrPayload = {
    v: NAMESPACE,
    b: data.businessId,
    s: data.staffProfileId,
    n: data.secret,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export type StaffQrVerifyResult =
  | { ok: true; payload: StaffQrPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "wrong_kind" };

/**
 * Kiểm chữ ký và hình dạng thẻ. KHÔNG đụng DB — chỗ gọi vẫn phải tự xác nhận
 * nhân viên còn tồn tại, đúng quán, còn hoạt động và `qrSecret` khớp.
 */
export function verifyStaffQrToken(token: string): StaffQrVerifyResult {
  const parts = token.trim().split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sig] = parts;

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: StaffQrPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  // Chữ ký đúng nhưng không phải thẻ nhân viên ⇒ báo riêng, đừng lẫn với thẻ hỏng.
  if (payload?.v !== NAMESPACE || !payload.b || !payload.s || !payload.n) {
    return { ok: false, reason: "wrong_kind" };
  }
  return { ok: true, payload };
}

export interface StaffQrResult {
  token: string;
  dataUrl: string; // PNG data URI — gắn thẳng vào <img>, tải về hoặc in
}

/** Vẽ thẻ chấm công ra PNG để in. */
export async function renderStaffQrPng(data: {
  businessId: string;
  staffProfileId: string;
  secret: string;
}): Promise<StaffQrResult> {
  const token = createStaffQrToken(data);
  const dataUrl = await QRCode.toDataURL(token, {
    // Thẻ nhân viên bị cầm nắm, dính dầu mỡ trong bếp và xước — mức sửa lỗi cao
    // hơn thẻ khách để máy vẫn đọc được khi thẻ đã cũ.
    errorCorrectionLevel: "H",
    margin: 1,
    width: 360,
  });
  return { token, dataUrl };
}
