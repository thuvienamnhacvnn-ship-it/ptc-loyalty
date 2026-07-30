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
- **WhatsApp bằng chính số của nhà hàng** — quét QR đăng nhập một lần (WhatsApp Web Multi-Device), gửi lời chào + thẻ QR khi đăng ký thành viên, thông báo cộng điểm / đổi quà / voucher; kiến trúc Provider thay thế được, **không dùng Meta Business API**.
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
| `ENCRYPTION_KEY` | ✅¹ | Khóa 32-byte (base64) mã hóa session key WhatsApp của từng nhà hàng (AES-256-GCM) |
| `WHATSAPP_PROVIDER` | ⬜ | `evolution` (mặc định) hoặc `log` (chế độ thử, không gửi thật) |
| `EVOLUTION_API_URL` | ✅¹ | URL gateway Evolution API (WhatsApp Web Multi-Device) |
| `EVOLUTION_API_KEY` | ✅¹ | Global API key của gateway |
| `EVOLUTION_API_VERSION` | ⬜ | `v2` (mặc định) hoặc `v1` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⬜ | Bật nút đăng nhập Google |
| `RESEND_API_KEY` / `EMAIL_FROM` | ⬜ | Gửi email (hiện mock) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⬜ | Billing (hiện mock) |
| `UPLOAD_PROVIDER_KEY` | ⬜ | Upload logo/ảnh |

¹ Bắt buộc nếu dùng WhatsApp. Mỗi nhà hàng tự kết nối **số WhatsApp của mình** bằng
cách quét mã QR trong **Dashboard → Settings → WhatsApp** — không cần Meta Business,
không cần xác minh doanh nghiệp. Session key của từng tenant lưu mã hóa.

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

### 💬 WhatsApp — gửi từ chính số của nhà hàng

**Không dùng Meta Business Cloud API. Không cần Business Verification, Facebook
Business Manager, App Review hay chờ Meta phê duyệt.** Mỗi nhà hàng dùng chính
số WhatsApp của mình; khách của Nhà hàng A luôn nhận tin từ số của Nhà hàng A.

**Kiến trúc Provider** (`src/lib/whatsapp/providers/`) — toàn bộ business logic
chỉ phụ thuộc vào interface `WhatsappProvider`:

```
connect()  disconnect()  getStatus()  sendText()  sendImage()  sendDocument()
```

- Mặc định: **Evolution API** (`providers/evolution.ts`) — gateway WhatsApp Web
  Multi-Device tự host, mỗi nhà hàng là một "instance".
- `providers/log.ts` — chế độ thử khi chưa cấu hình gateway (ghi log, không gửi).
- Thêm Baileys / Green API / CodeChat / WAHA = viết thêm **một file** trong thư
  mục này rồi đăng ký ở `providers/index.ts`; không đụng tới business logic.

**Quy trình kết nối** (Dashboard → Settings → WhatsApp):
1. Chủ nhà hàng bấm **“Kết nối WhatsApp”**.
2. Hệ thống hiện mã QR đăng nhập WhatsApp Web (tự làm mới khi hết hạn).
3. Chủ nhà hàng quét bằng điện thoại (WhatsApp → Thiết bị đã liên kết).
4. Phiên đăng nhập được lưu (`WhatsAppConnection`, session key mã hóa AES-256-GCM).
5. Từ đó mọi tin nhắn gửi bằng chính số của nhà hàng.

**Khách tự đăng ký tại bàn** — `Dashboard → QR đăng ký khách` in ra mã QR của
quán (`/j/<slug>`). Khách quét → nhập **tên + số WhatsApp** (không cần mật khẩu,
không cần email) → hệ thống lưu Member → lấy QR định danh **đã có sẵn**
(`src/lib/qr.ts`, không tạo lại) → provider gửi ngay (1) lời chào kèm mã thành
viên, (2) ảnh QR kèm hướng dẫn tích điểm, **từ chính số của nhà hàng**. Mã QR
cũng hiện luôn trên màn hình để khách chụp lại nếu WhatsApp chưa kết nối.

Nhân viên tạo khách từ dashboard hoặc app POS cũng đi qua đúng luồng đó
(`sendMemberCardWhatsApp`).

- **Gửi không đồng bộ** cho thông báo giao dịch qua `src/lib/jobs/queue.ts`
  (in-process, retry có giới hạn); lỗi gửi **không bao giờ** làm hỏng giao dịch
  tích điểm. Đổi sang BullMQ/Upstash QStash chỉ cần thay driver trong file này.
- **Consent tách riêng**: `CustomerCommunicationConsent.whatsappTransactional`
  (giao dịch) vs `whatsappMarketing`.
- **Idempotency**: `earn:<txnId>` / `redeem:<txnId>` / `voucher:<cvId>`
  (unique `[businessId, idempotencyKey]`) → không gửi trùng.
- **Webhook** `POST /api/whatsapp/webhook/[businessId]?secret=…`: tenant lấy từ
  đường dẫn, secret so sánh constant-time; xử lý `qrcode.updated`,
  `connection.update`, `messages.upsert`, `messages.update` (delivered/read).
- **Nội dung 3 ngôn ngữ** (vi/de/en) trong `src/lib/whatsapp/templates.ts`, mỗi
  nhà hàng ghi đè được qua bảng `WhatsAppTemplate`. Mọi bảng WhatsApp đều scope
  theo `businessId`.

---

## ☁️ Deploy production (VPS + Docker)

Toàn bộ hệ thống chạy bằng Docker trên một VPS: nginx + TLS Let's Encrypt,
Next.js standalone, PostgreSQL, Redis và gateway WhatsApp Web Multi-Device.

**Hướng dẫn đầy đủ: [`deploy/README.md`](deploy/README.md)**

```bash
# trên VPS
git clone <repo> /opt/ptc-bonus && cd /opt/ptc-bonus
bash deploy/bootstrap-vps.sh          # Docker, UFW, Fail2Ban, swap
cp .env.production.example .env.production && nano .env.production
bash deploy/init-ssl.sh               # chứng chỉ lần đầu
bash deploy/deploy.sh                 # build + khởi động
```

Gateway WhatsApp **không mở ra Internet** — app gọi nó qua mạng nội bộ Docker,
nên webhook không bao giờ rời khỏi máy chủ.

> Kiến trúc vẫn deploy được lên Vercel, nhưng gateway WhatsApp Web Multi-Device
> cần một tiến trình chạy liên tục nên không thể nằm trong serverless function.

---

## ⚠️ Giới hạn hiện tại (demo)

- Gửi **email** (reset password, campaign) được **mock** — kiến trúc sẵn sàng cắm Resend/SendGrid.
- **Billing Stripe** ở chế độ mock (UI + giới hạn gói hoạt động thật, chưa charge).
- Nhân viên được tạo với mật khẩu tạm (chưa có luồng email mời qua `Invitation`).
- Điểm hết hạn (`pointsExpiryDays`) đã có trong schema/cấu hình nhưng job hết hạn chưa chạy nền.
- Upload logo dùng URL (chưa tích hợp provider lưu file).
- **WhatsApp**: cần một gateway WhatsApp Web Multi-Device chạy liên tục (Evolution API,
  Docker trên VPS) — không chạy được trong serverless function. Chưa cấu hình gateway thì
  hệ thống tự dùng provider `log` (không gửi thật). Hàng đợi hiện chạy **in-process**;
  trên serverless nên đổi sang QStash/BullMQ (swap point ở `src/lib/jobs/queue.ts`).

---

## 🧪 Test

```bash
npm run test
```
Bao phủ: tính điểm (tỷ lệ, làm tròn, tier multiplier, min/max), đủ/không đủ điểm,
ký & verify QR (hợp lệ, giả mạo, sai chữ ký, hết hạn, malformed).
