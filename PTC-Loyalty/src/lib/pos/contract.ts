// ─────────────────────────────────────────────────────────────────────────────
// POS API contract — shared DTOs between the Next.js backend and the Electron
// desktop client (apps/desktop). This file is PURE TYPES with no runtime
// imports so the desktop app can import it type-only across the repo boundary
// without pulling in Prisma / server code.
//
// The desktop client references these via its tsconfig path alias
// `@shared/*` -> `../../src/lib/*`.
// ─────────────────────────────────────────────────────────────────────────────

/** Roles allowed to use the desktop POS client. Super admin & customer excluded. */
export type PosRole = "BUSINESS_OWNER" | "BUSINESS_MANAGER" | "STAFF";

export interface PosBranch {
  id: string;
  name: string;
}

export interface PosBusiness {
  id: string;
  name: string;
  slug: string;
  currency: string;
}

export interface PosUser {
  id: string;
  name: string | null;
  email: string;
  role: PosRole;
}

/** Returned by /auth/login and (minus tokens) by /me. */
export interface PosSessionInfo {
  user: PosUser;
  business: PosBusiness;
  branches: PosBranch[];
  /** When set, this staff member is pinned to a single branch and may not pick. */
  fixedBranchId: string | null;
}

export interface PosLoginResponse extends PosSessionInfo {
  accessToken: string;
  accessExpiresAt: number; // unix ms
  refreshToken: string;
  refreshExpiresAt: number; // unix ms
}

export interface PosRefreshResponse {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface PosCustomer {
  id: string;
  name: string;
  memberCode: string;
  pointsBalance: number;
  tier: string | null;
  phone: string | null;
  email: string | null;
}

export interface PosTransactionSummary {
  id: string;
  type: string;
  points: number;
  amount: number | null;
  balanceAfter: number;
  note: string | null;
  createdAt: string; // ISO
}

/** A transaction in the store-wide history list (carries the customer). */
export interface PosTransactionListItem extends PosTransactionSummary {
  customerId: string;
  customerName: string;
  memberCode: string;
}

/** A staff member for the desktop admin "Nhân viên" screen. */
export interface PosStaff {
  id: string;
  name: string | null;
  /** Rỗng với nhân viên thường — họ không có tài khoản đăng nhập. */
  email: string | null;
  role: string; // STAFF | BUSINESS_MANAGER | BUSINESS_OWNER
  branchId: string | null;
  branchName: string | null;
  maxPointsGrant: number | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

/** Counter dashboard summary for the desktop "Tổng quan" screen. */
export interface PosStats {
  customersTotal: number;
  customersNewToday: number;
  transactionsToday: number;
  pointsEarnedToday: number;
  pointsRedeemedToday: number;
  transactionsTotal: number;
}

export interface PosCustomerDetail extends PosCustomer {
  totalEarned: number;
  totalRedeemed: number;
  visitCount: number;
  recentTransactions: PosTransactionSummary[];
  vouchers: PosCustomerVoucher[];
}

export interface PosCustomerVoucher {
  id: string;
  code: string;
  title: string;
  status: string;
  expiresAt: string | null;
}

export interface PosReward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
}

/** A store voucher for the desktop "Voucher" catalog screen. */
export interface PosVoucherListItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: string; // percent | fixed | free_item
  discountValue: number;
  pointsCost: number;
  quantity: number | null; // null = unlimited
  issuedCount: number;
  status: string; // DRAFT | ACTIVE | PAUSED | EXPIRED | ...
  expiresAt: string | null;
}

export interface PosEarnPreview {
  amount: number;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
}

/** Status of the WhatsApp notification triggered by a transaction. */
export type PosWhatsAppStatus =
  | "NONE" // no connection / no consent — nothing was sent
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED";

export interface PosTransactionResult {
  transactionId: string;
  points: number;
  balanceAfter: number;
  whatsapp: PosWhatsAppStatus;
}

export interface PosVoucherRedeemResult {
  voucherId: string;
  code: string;
  title: string;
}

/** A WhatsApp message row for the POS/desktop conversation view. */
export interface PosWhatsAppMessage {
  id: string;
  kind: string;
  status: string;
  direction: string; // "INBOUND" | "OUTBOUND"
  toPhone: string;
  fromPhone: string | null;
  text: string;
  customerId: string | null;
  customerName: string | null;
  error: string | null;
  createdAt: string;
}

/** Uniform error envelope returned by every POS endpoint on failure. */
export interface PosErrorBody {
  error: string; // machine code, e.g. "unauthorized", "customer_not_found"
  message: string; // human-readable (vi) message
}

export const POS_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  forbidden: "Tài khoản không có quyền sử dụng ứng dụng cửa hàng.",
  invalid_credentials: "Email hoặc mật khẩu không đúng.",
  no_business: "Tài khoản chưa được gán vào cửa hàng nào.",
  invalid_branch: "Chi nhánh không hợp lệ.",
  customer_not_found: "Không tìm thấy khách hàng.",
  duplicate_submit: "Giao dịch đã được xử lý.",
  receipt_reused: "Hóa đơn này đã được sử dụng.",
  rate_limited: "Quá nhiều giao dịch trong thời gian ngắn. Thử lại sau.",
  self_grant: "Không thể tự cộng điểm cho chính mình.",
  staff_cap_exceeded: "Vượt giới hạn điểm nhân viên được phép cấp.",
  insufficient_points: "Khách không đủ điểm để đổi.",
  invalid_amount: "Số tiền không hợp lệ.",
  voucher_not_found: "Không tìm thấy voucher hợp lệ.",
  voucher_used: "Voucher đã được sử dụng.",
  voucher_expired: "Voucher đã hết hạn.",
  qr_expired: "Mã QR đã hết hạn. Yêu cầu khách làm mới.",
  qr_bad_signature: "Mã QR không hợp lệ.",
  qr_malformed: "Mã QR không đọc được.",
  qr_other_business: "Mã QR thuộc doanh nghiệp khác.",
  qr_revoked: "Mã QR đã bị thu hồi.",
  bad_request: "Yêu cầu không hợp lệ.",
  phone_taken: "Số điện thoại này đã được đăng ký.",
  email_taken: "Email này đã được đăng ký.",
  invalid_password: "Mật khẩu không đúng.",
  server_error: "Lỗi máy chủ. Vui lòng thử lại.",
};
