# PTC Loyalty — Desktop Client (Windows)

Ứng dụng khách trên máy tính Windows tại cửa hàng, dành cho **Business Owner /
Manager / Staff**. Đây **chỉ là client** — webapp Next.js hiện tại vẫn là backend
và nền tảng quản trị trung tâm. Desktop app kết nối tới API của hệ thống qua
HTTPS; **không** chứa database, secret, hay quyền Super Admin.

Xây bằng **Electron** (không phải Tauri). Lý do chọn Electron được giải thích ở
mục [Vì sao Electron](#vì-sao-electron-thay-vì-tauri).

---

## Kiến trúc & bảo mật

```
┌────────────────────────┐        HTTPS (Bearer token)        ┌───────────────────────────┐
│  Desktop (Electron)    │  ───────────────────────────────► │  Webapp Next.js (backend)  │
│                        │                                    │                            │
│  Renderer (React)      │   window.pos.*  (IPC, không token) │  /api/pos/*  REST endpoints│
│    – Login / Scanner   │  ◄──────────────┐                  │  requirePosContext()       │
│    – POS / Settings    │                 │                  │  → businessId từ StaffProfile
│                        │                 │ ipcMain.handle   │  → kiểm tra role & branch   │
│  Main process (Node)   │ ────────────────┘                  │  earnPoints/redeemPoints... │
│    – access token (RAM)│                                    │  Prisma → PostgreSQL (Neon) │
│    – refresh token     │                                    └───────────────────────────┘
│      (DPAPI encrypted) │
│    – offline queue     │
│      (DPAPI encrypted) │
│    – silent printing   │
└────────────────────────┘
```

**Nguyên tắc bảo mật đã áp dụng:**

- **Mọi request mạng chạy ở main process (Node)** — renderer không bao giờ chạm
  token thô, và tránh hoàn toàn CORS.
- **Access token** (HMAC JWT, sống 1 giờ) chỉ nằm trong RAM của main process.
- **Refresh token** (opaque, xoay vòng mỗi lần refresh) được mã hoá bằng
  **Windows DPAPI** (`safeStorage`) và lưu ở `userData`. **Không** lưu token thô
  trong `localStorage`. Server chỉ lưu **SHA-256 hash** của refresh token.
- **businessId luôn do server xác định** từ `StaffProfile` của người đăng nhập —
  desktop **không thể tự chỉ định** businessId. Chi nhánh (branchId) do server
  kiểm tra thuộc về business; nhân viên bị ghim chi nhánh không thể đổi.
- **Super Admin / Customer bị chặn** ở tầng API (`/api/pos/auth/login` và
  `requirePosContext` yêu cầu `StaffProfile` là OWNER/MANAGER/STAFF).
- **TLS luôn bật**: production bắt buộc `https://`; chỉ `localhost` mới cho phép
  `http://`. Không có tuỳ chọn tắt kiểm tra chứng chỉ.
- **CSP** khoá renderer: không remote code, `connect-src 'self'`.

---

## Yêu cầu môi trường

- Node.js ≥ 20 (đã test trên v24) + npm.
- Windows 10/11 để build installer & chạy app.
- Webapp PTC Loyalty đang chạy (dev: `http://localhost:4000`).

---

## 1) Chạy ở chế độ Development

Backend (thư mục gốc repo) và desktop app chạy song song.

```bash
# Terminal 1 — webapp (backend). Dev server mặc định của dự án chạy cổng 4000:
cd ptc-loyalty
npm run dev -- -p 4000

# Terminal 2 — desktop client:
cd ptc-loyalty/apps/desktop
npm install        # lần đầu
npm run dev        # mở cửa sổ Electron, nạp Vite dev server + DevTools
```

Desktop dev **mặc định** trỏ tới `http://localhost:4000`. Có thể đổi trong
màn hình **Settings → Địa chỉ máy chủ API**, hoặc bằng biến môi trường
`POS_API_BASE_URL` (xem `.env.example`).

Đăng nhập thử bằng tài khoản demo (mật khẩu `demo1234`):
`owner@pho-hanoi.de`, `staff@pho-hanoi.de`, `owner@nail-berlin.de`.
(Tài khoản `admin@ptc.de` là Super Admin — sẽ **bị từ chối** đăng nhập, đúng thiết kế.)

---

## 2) Cấu hình API cho Development vs Production

Thứ tự ưu tiên (`electron/config.ts`):

1. Ghi đè trong **Settings** (lưu vào máy).
2. Biến môi trường `POS_API_BASE_URL`.
3. Mặc định theo `app.isPackaged`:
   - **Dev**: `http://localhost:4000`
   - **Prod**: `https://app.ptc-loyalty.example`

> Trước khi phát hành installer production, sửa `PROD_DEFAULT` trong
> `electron/config.ts` thành domain chính thức của nền tảng.

---

## 3) Build installer Windows (.exe)

```bash
cd ptc-loyalty/apps/desktop

# Build không ký — dùng cho máy dev không có quyền admin (khuyến nghị để test):
npm run dist:unsigned

# Build production (ký nếu có chứng chỉ CSC_LINK/CSC_KEY_PASSWORD):
npm run dist
```

Kết quả nằm ở `apps/desktop/release/`:

- `PTC Loyalty Kasse-Setup-0.1.0.exe` — **installer NSIS** (cho phép chọn thư mục,
  tạo shortcut Desktop/Start Menu).
- `latest.yml` + `*.blockmap` — feed và dữ liệu cập nhật vi sai cho auto-update.

> **Lưu ý winCodeSign / Windows privilege.** `npm run dist` (đường ký) cần
> electron-builder giải nén gói `winCodeSign`, trong đó có 2 symlink macOS.
> Trên máy Windows **không có quyền admin và chưa bật Developer Mode**, việc tạo
> symlink bị chặn và bước này lỗi. Dùng `npm run dist:unsigned` (đặt
> `win.signAndEditExecutable=false`) để bỏ qua và tạo installer không ký — đây là
> cách đã dùng để tạo file cài đặt thử nghiệm trong repo. Để ký production, chạy
> trên máy build có bật **Developer Mode** hoặc quyền Administrator.

Muốn xuất thêm `.msi`: `npm run dist:msi`.

---

## 4) Auto-update

Dùng `electron-updater`. Cấu hình feed ở `electron-builder.yml` (`publish`):

```yaml
publish:
  - provider: generic
    url: https://downloads.ptc-loyalty.example/desktop/
    channel: latest
```

Quy trình phát hành bản mới:

1. Tăng `version` trong `apps/desktop/package.json`.
2. `npm run dist` (hoặc `dist:unsigned`).
3. Tải toàn bộ nội dung `release/` (`*.exe`, `latest.yml`, `*.blockmap`) lên URL
   `publish.url` ở trên.
4. Client đang mở sẽ tự kiểm tra khi khởi động (và mỗi 6 giờ), tải nền, và hiện
   banner **"Cài đặt & khởi động lại"**. Auto-update **chỉ hoạt động ở bản đóng
   gói** (không chạy trong dev).

---

## Tính năng desktop (đã có)

- Đăng nhập / đăng xuất; ghi nhớ phiên an toàn (DPAPI); tự refresh token.
- Chọn chi nhánh khi nhân viên thuộc nhiều chi nhánh.
- Màn hình quầy thu ngân đơn giản.
- Quét QR khách bằng webcam (BarcodeDetector) + **chọn camera**.
- Máy quét QR USB (dạng keyboard input) — hoạt động không cần bật camera.
- Tìm khách bằng tên / SĐT / email / mã thành viên.
- Nhập số tiền hóa đơn → **hiển thị điểm dự kiến** trước khi xác nhận.
- Cộng điểm, đổi điểm (theo catalog phần thưởng), xác nhận voucher.
- Xem số điểm hiện tại + lịch sử giao dịch gần nhất.
- Hiển thị **trạng thái gửi WhatsApp** của giao dịch.
- Loading / success / error state rõ ràng.
- **Chống gửi hai lần**: idempotency key + khoá in-flight.
- Toàn màn hình / **Kiosk mode**.
- **In biên nhận im lặng** ra máy in mặc định (hoặc máy in đã chọn).
- Trang **Settings**: chọn camera, máy in, API server; kiểm tra kết nối.
- **Kiểm tra kết nối internet** định kỳ; khi mất mạng **không giả báo thành công**.
- **Hàng đợi cục bộ mã hoá** cho giao dịch EARN chưa gửi; yêu cầu nhân viên xác
  nhận **đồng bộ lại**; chống gửi trùng bằng idempotency key (server dedup).
- Auto-update + installer `.exe`.

---

## API POS phía server (trong webapp)

Tất cả nằm dưới `src/app/api/pos/` và dùng chung engine nghiệp vụ hiện có
(`src/lib/points.ts`, `src/lib/transactions.ts`, `src/lib/qr.ts`) — **không**
sao chép business logic sang desktop.

| Method | Endpoint                          | Mô tả                                   |
| ------ | --------------------------------- | --------------------------------------- |
| GET    | `/api/pos/ping`                   | Probe kết nối (không cần auth)          |
| POST   | `/api/pos/auth/login`             | Đăng nhập → access + refresh token      |
| POST   | `/api/pos/auth/refresh`           | Xoay vòng token                         |
| POST   | `/api/pos/auth/logout`            | Thu hồi refresh token                   |
| GET    | `/api/pos/me`                     | Thông tin phiên / business / chi nhánh  |
| GET    | `/api/pos/customers/search?q=`    | Tìm khách                               |
| POST   | `/api/pos/customers/resolve-qr`   | Giải mã QR → khách                      |
| GET    | `/api/pos/customers/:id`          | Chi tiết + giao dịch gần đây + voucher  |
| POST   | `/api/pos/transactions/preview`   | Điểm dự kiến (không ghi)                |
| POST   | `/api/pos/transactions/earn`      | Cộng điểm (idempotent)                  |
| POST   | `/api/pos/transactions/redeem`    | Đổi điểm                                |
| POST   | `/api/pos/vouchers/redeem`        | Xác nhận voucher                        |
| GET    | `/api/pos/rewards`                | Catalog phần thưởng                     |

Cấu hình phía server: đặt `POS_JWT_SECRET` (hoặc dùng `AUTH_SECRET` sẵn có) và
đảm bảo bảng `PosRefreshToken` đã được migrate (`npx prisma db push`).

---

## Vì sao Electron thay vì Tauri?

Tauri hợp lý về mặt kỹ thuật, nhưng Electron được chọn vì:

1. **Build được ngay**: Tauri cần Rust toolchain + MSVC C++ Build Tools; máy build
   hiện tại **không có Rust**. Electron build hoàn toàn bằng npm.
2. **In biên nhận im lặng**: `webContents.print({ silent, deviceName })` là hạng
   nhất cho POS; Tauri không có in im lặng gốc.
3. **Secure storage gốc**: `safeStorage` dùng DPAPI sẵn có trên Windows.
