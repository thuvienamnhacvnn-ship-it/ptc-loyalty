# PTC Loyalty Platform

Nền tảng khách hàng thân thiết, tích điểm, voucher và quản lý QR **multi-tenant SaaS**
dành cho doanh nghiệp Việt tại Đức (nhà hàng, café, nail & beauty salon, bán lẻ, dịch vụ).

Khách hàng **không cần tải app** — dùng thẻ thành viên QR ngay trên trình duyệt (PWA).
Mỗi doanh nghiệp là một tenant riêng biệt; dữ liệu được cách ly ở tầng máy chủ.

---

## ✨ Tính năng chính

- **Multi-tenant SaaS** — mỗi doanh nghiệp có khách hàng, nhân viên, chi nhánh, thương hiệu, chương trình riêng. Cách ly `businessId` ở mọi truy vấn server-side.
- **RBAC** — Super Admin · Business Owner · Manager · Staff · Customer.
- **Thẻ thành viên QR động** — token ký HMAC, hết hạn 60s (chống sao chép/chụp màn hình).
- **Máy quét QR** — camera (BarcodeDetector) + tìm khách thủ công, cộng điểm tự động.
- **Engine giao dịch chống gian lận** — idempotency key, chống dùng lại hóa đơn, giới hạn tần suất, giới hạn điểm nhân viên, chặn tự cộng điểm, cảnh báo giao dịch lớn.
- **Membership tiers** — Bronze → Platinum với hệ số điểm, tự động thăng hạng.
- **Voucher · Rewards catalog · Campaigns · Reports (CSV export)**.
- **WhatsApp Business (Meta Cloud API)** — tự động gửi thông báo giao dịch (cộng điểm / đổi quà / voucher), consent tách riêng, token mã hóa, webhook trạng thái, hàng đợi + retry, lịch sử theo tenant.
- **Super Admin console** — quản lý doanh nghiệp, thuê bao, gian lận, audit logs, feature flags.
- **Customer portal** — thẻ QR, điểm, voucher, đổi quà, lịch sử, hồ sơ (GDPR).
- **i18n** (vi/de/en), **EUR**, **Europe/Berlin**, định dạng ngày Đức, **dark mode**, **responsive**.

---

## 🧱 Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript |
| UI | Tailwind CSS · shadcn-style components · Radix UI · Lucide · Recharts |
| Auth | Auth.js (NextAuth v5) — credentials + Google (tùy chọn), JWT session |
| DB | PostgreSQL · Prisma ORM |
| QR | `qrcode` + HMAC token ký bằng `crypto` |
| Validation | Zod · React Hook Form |
| Tests | Vitest |

---

## 🚀 Cài đặt & chạy local

### 1. Yêu cầu
- Node.js ≥ 20
- Một PostgreSQL database (local, hoặc [Neon](https://neon.tech) / [Supabase](https://supabase.com) / [Railway](https://railway.app))

### 2. Cài dependency
```bash
npm install
```

### 3. Cấu hình environment
```bash
cp .env.example .env
```
Điền các biến (xem phần dưới). Bắt buộc: `DATABASE_URL`, `AUTH_SECRET`, `QR_SIGNING_SECRET`.

Tạo secret nhanh:
```bash
npx auth secret            # sinh AUTH_SECRET
openssl rand -base64 32    # dùng cho QR_SIGNING_SECRET
```

### 4. Khởi tạo database
```bash
npm run db:push      # đẩy schema vào DB (hoặc: npm run db:migrate)
npm run db:seed      # nạp dữ liệu demo
```

### 5. Chạy dev
```bash
npm run dev          # http://localhost:3000
```

### Các lệnh khác
```bash
npm run build        # prisma generate + next build (production)
npm run start        # chạy bản production
npm run typecheck    # kiểm tra type
npm run lint         # eslint
npm run test         # vitest (points engine + QR)
npm run db:studio    # Prisma Studio
```

---

## 👤 Tài khoản demo

Mật khẩu chung: **`demo1234`**

| Vai trò | Email | Vào |
|---------|-------|-----|
| Super Admin | `admin@ptc.de` | `/admin` |
| Chủ quán (Phở Hà Nội) | `owner@pho-hanoi.de` | `/dashboard` |
| Quản lý | `manager@pho-hanoi.de` | `/dashboard` |
| Nhân viên | `staff@pho-hanoi.de` | `/dashboard/scanner` |
| Khách hàng | `khach@demo.de` | `/member` |
| Chủ salon (Beauty Nails) | `owner@nail-berlin.de` | `/dashboard` |

Trang công khai của tenant: `/business/pho-hanoi` · `/business/nail-berlin`

---

## 🔑 Environment variables

| Biến | Bắt buộc | Mô tả |
|------|:--:|------|
| `DATABASE_URL` | ✅ | Chuỗi kết nối PostgreSQL |
| `AUTH_SECRET` | ✅ | Secret cho Auth.js |
| `NEXTAUTH_URL` | ✅ | URL ứng dụng (vd `http://localhost:3000`) |
| `QR_SIGNING_SECRET` | ✅ | Secret HMAC ký token QR |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL công khai |
| `ENCRYPTION_KEY` | ✅¹ | Khóa 32-byte (base64) mã hóa access token WhatsApp (AES-256-GCM) |
| `WHATSAPP_APP_SECRET` | ⬜ | Meta App Secret — xác thực chữ ký webhook |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ⬜ | Token xác minh webhook (khớp với Meta) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⬜ | Bật nút đăng nhập Google |
| `RESEND_API_KEY` / `EMAIL_FROM` | ⬜ | Gửi email (hiện mock) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⬜ | Billing (hiện mock) |
| `UPLOAD_PROVIDER_KEY` | ⬜ | Upload logo/ảnh |

¹ Bắt buộc nếu dùng WhatsApp. Per-tenant Phone Number ID / WABA ID / Access Token
được cấu hình trong **Dashboard → Settings → WhatsApp** (token lưu mã hóa theo tenant).

---

## 🏗️ Kiến trúc

```
src/
├── app/
│   ├── (auth)/            # login, register (doanh nghiệp), forgot-password + server actions
│   ├── dashboard/         # Business dashboard (owner/manager/staff) — guarded
│   ├── admin/             # Super Admin console — guarded
│   ├── member/            # Customer portal + /api/member/qr (QR động)
│   ├── business/[slug]/   # Trang công khai tenant + đăng ký khách (join)
│   ├── (marketing pages)  # /, /features, /pricing, /about, /contact
│   ├── (legal)            # /privacy, /terms, /cookies, /data-request (GDPR)
│   └── manifest.ts        # PWA manifest
├── components/            # ui/ (shadcn-style) · dashboard/ · admin/ · member/ · marketing/
├── lib/
│   ├── db.ts              # Prisma singleton
│   ├── auth… (../auth.ts) # Auth.js config
│   ├── tenant.ts          # 🔒 choke-point cách ly tenant (requireBusinessContext, v.v.)
│   ├── rbac.ts            # phân quyền theo vai trò
│   ├── points.ts          # engine tính điểm (pure, unit-tested)
│   ├── transactions.ts    # engine giao dịch + anti-fraud + tier recalc
│   ├── qr.ts              # ký/verify token QR (HMAC, unit-tested)
│   └── provision.ts       # tạo tenant với cấu hình mặc định
└── prisma/schema.prisma   # 30+ model, đầy đủ enum & index
```

### 🔒 Multi-tenant security
- Mọi bảng tenant có `businessId`. Truy vấn dashboard đi qua `requireBusinessContext()`
  (`src/lib/tenant.ts`) — resolve business từ `StaffProfile` của user và enforce ở server.
- Chi tiết khách hàng/giao dịch kiểm tra `businessId` khớp context trước khi render
  (`assertSameTenant`, kiểm tra `notFound()` khi lệch tenant).
- Không dựa vào ẩn UI ở frontend. Doanh nghiệp bị `SUSPENDED` chặn đăng nhập dashboard.

### 🎫 QR flow
1. Khách mở `/member` → client gọi `/api/member/qr` mỗi ~60s.
2. Server ký token `base64url(payload).HMAC` chứa `businessId, customerId, memberCode, secret, exp`.
3. Nhân viên quét → `resolveQrToken()` verify chữ ký + hạn + khớp tenant + `qrSecret`.
4. Nhập hóa đơn → `earnPoints()` chạy anti-fraud, tạo giao dịch idempotent, cập nhật điểm & hạng.
> Rotate `CustomerProfile.qrSecret` để vô hiệu hóa mọi QR cũ của một khách.

### 🛡️ Chống gian lận
Idempotency key · hóa đơn dùng một lần · giới hạn giao dịch/giờ/khách · giới hạn điểm/nhân viên ·
chặn nhân viên tự cộng điểm · cảnh báo giao dịch lớn · audit log · bảng `FraudAlert` (LOW→CRITICAL).

### 💬 WhatsApp Business (Meta Cloud API chính thức)
- Sau khi `earnPoints()` commit thành công → gửi thông báo WhatsApp cho khách:
  tên cửa hàng, điểm vừa nhận, tổng điểm, điểm còn thiếu để đổi quà/lên hạng, link `/member`.
- **Gửi không đồng bộ** qua abstraction `src/lib/jobs/queue.ts` (in-process, retry có giới hạn);
  lỗi gửi **không bao giờ** làm hỏng giao dịch tích điểm (được bọc try/catch, log QUEUED trước).
  Đổi sang BullMQ/Upstash QStash chỉ cần thay driver trong file này.
- **Consent tách riêng**: `CustomerCommunicationConsent.whatsappTransactional` (giao dịch) vs
  `whatsappMarketing`. Chỉ gửi khi khách đồng ý nhận thông báo giao dịch + có số điện thoại.
- **Bảo mật token**: access token lưu **mã hóa AES-256-GCM** (`src/lib/crypto.ts`,
  cột `WhatsAppConnection.accessTokenCipher`), chỉ ở server, không bao giờ xuống frontend.
- **Idempotency**: mỗi tin nhắn khóa theo `earn:<txnId>` / `redeem:<txnId>` / `voucher:<cvId>`
  (unique `[businessId, idempotencyKey]`) → không gửi trùng.
- **Webhook** `POST /api/webhooks/whatsapp`: xác thực chữ ký `X-Hub-Signature-256`, cập nhật
  trạng thái `sent / delivered / read / failed` theo `wamid`, map tenant qua `phone_number_id`.
- **Template 3 ngôn ngữ** (vi/de/en) trong `src/lib/whatsapp/templates.ts`; mọi bảng WhatsApp
  (`WhatsAppConnection`, `WhatsAppTemplate`, `WhatsAppMessageLog`, `CustomerCommunicationConsent`)
  đều scope theo `businessId`. Cấu hình tại **Dashboard → Settings → WhatsApp**.

---

## ☁️ Deploy (Vercel)

1. Tạo Postgres (Neon/Supabase/Railway) → lấy `DATABASE_URL`.
2. Import repo vào Vercel, thêm environment variables (mục trên).
3. Build command mặc định `npm run build` đã bao gồm `prisma generate`.
4. Sau lần deploy đầu, chạy migrate + seed một lần:
   ```bash
   npx prisma migrate deploy
   npm run db:seed   # tùy chọn (dữ liệu demo)
   ```

---

## ⚠️ Giới hạn hiện tại (demo)

- Gửi **email** (reset password, campaign) được **mock** — kiến trúc sẵn sàng cắm Resend/SendGrid.
- **Billing Stripe** ở chế độ mock (UI + giới hạn gói hoạt động thật, chưa charge).
- Nhân viên được tạo với mật khẩu tạm (chưa có luồng email mời qua `Invitation`).
- Điểm hết hạn (`pointsExpiryDays`) đã có trong schema/cấu hình nhưng job hết hạn chưa chạy nền.
- Upload logo dùng URL (chưa tích hợp provider lưu file).
- **WhatsApp**: gửi thật cần credentials Meta thật (Phone Number ID + WABA ID + Access Token)
  và template đã được duyệt. Hàng đợi hiện chạy **in-process**; trên serverless nên đổi sang
  QStash/BullMQ để đảm bảo job chạy sau khi response trả về (swap point ở `src/lib/jobs/queue.ts`).

---

## 🧪 Test

```bash
npm run test
```
Bao phủ: tính điểm (tỷ lệ, làm tròn, tier multiplier, min/max), đủ/không đủ điểm,
ký & verify QR (hợp lệ, giả mạo, sai chữ ký, hết hạn, malformed).
