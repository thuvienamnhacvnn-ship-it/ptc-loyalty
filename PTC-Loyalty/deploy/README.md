# PTC-BONUS — triển khai production trên VPS OVHcloud

Toàn bộ hệ thống chạy bằng Docker. Trên host chỉ cài Docker, UFW và Fail2Ban —
không cài Node, không cài Postgres, không cài nginx trực tiếp.

```
                    Internet
                       │ 80 / 443
                  ┌────▼─────┐
                  │  nginx   │  TLS Let's Encrypt, rate limit, gzip
                  └────┬─────┘
        ┌──────────────┴───────────────┐  mạng nội bộ Docker
   ┌────▼────┐   ┌──────────┐   ┌──────▼─────┐   ┌────────┐
   │   app   │◄─►│ postgres │◄─►│ evolution  │◄─►│ redis  │
   │ Next.js │   │ 2 DB     │   │ WhatsApp   │   │ cache  │
   └─────────┘   └──────────┘   └────────────┘   └────────┘
```

Evolution (gateway WhatsApp) **không mở ra Internet**. App gọi nó qua
`http://evolution:8080`, nó gọi ngược lại app qua `http://app:3000` — webhook
không bao giờ rời khỏi máy.

| Container | RAM giới hạn | Vai trò |
|---|---|---|
| evolution | 6 GB | phiên WhatsApp Web MD của từng nhà hàng |
| postgres | 2 GB | DB app + DB session gateway |
| app | 1,5 GB | Next.js standalone |
| redis | 384 MB | cache gateway |
| nginx | 192 MB | reverse proxy + TLS |

Tổng ~10 GB / 12 GB, cộng 4 GB swap do script bootstrap tạo.

---

## Cách nhanh nhất: một lệnh

Sau khi DNS đã trỏ (bước 1 bên dưới), SSH vào VPS bằng root và chạy:

```bash
curl -fsSL https://raw.githubusercontent.com/thuvienamnhacvnn-ship-it/ptc-loyalty/main/PTC-Loyalty/deploy/install.sh | bash
```

> Gốc repo là thư mục home của máy dev, nên project nằm trong thư mục con
> `PTC-Loyalty/` — vì thế URL có đoạn đó. Script tự dò thư mục project theo
> `docker-compose.prod.yml`, đường dẫn có đổi cũng không sao.

Script tự làm hết: kiểm tra RAM/đĩa/DNS → cài Docker + gia cố → tải code →
sinh secrets → xin chứng chỉ TLS → build → khởi động → kiểm tra
`https://ptc-bonus.com/api/health` từ ngoài vào.

Chạy lại được nhiều lần — mỗi bước tự bỏ qua nếu đã xong, nên cũng dùng để
**cập nhật code** về sau.

Muốn hiểu từng bước hoặc cần xử lý thủ công thì theo phần dưới.

---

## Chạy lần lượt

### 1. DNS

Tại nhà cung cấp DNS của `ptc-bonus.com`:

```
A   @     162.19.44.241
A   www   162.19.44.241
```

Xác nhận trước khi đi tiếp — Let's Encrypt sẽ thất bại nếu DNS chưa trỏ đúng:

```bash
dig +short ptc-bonus.com        # phải ra 162.19.44.241
```

### 2. Chuẩn bị VPS

```bash
ssh root@162.19.44.241

apt update && apt install -y git
git clone https://github.com/thuvienamnhacvnn-ship-it/ptc-loyalty.git /opt/ptc-bonus
cd /opt/ptc-bonus/PTC-Loyalty      # project nằm trong thư mục con của repo

bash deploy/bootstrap-vps.sh
```

Script này cài Docker, tạo swap 4 GB, bật UFW (chỉ 22/80/443), Fail2Ban cho SSH,
giới hạn log Docker và bật cập nhật bảo mật tự động.

### 3. Biến môi trường

```bash
cd /opt/ptc-bonus/PTC-Loyalty
bash deploy/gen-env.sh admin@ptc-bonus.com
```

Script sinh toàn bộ 7 khóa ngẫu nhiên ngay trên server và ghi `.env.production`
(chmod 600) — không phải gõ hay dán secret nào.

Sao lưu file này ra nơi an toàn: **mất `ENCRYPTION_KEY` nghĩa là mọi nhà hàng
phải quét lại mã QR WhatsApp.** Muốn xem lại giá trị: `cat .env.production`.

`.env.production.example` chỉ để tham khảo ý nghĩa từng biến.

### 4. Chứng chỉ TLS (chạy một lần)

```bash
bash deploy/init-ssl.sh
```

### 5. Khởi động

```bash
bash deploy/deploy.sh
```

Script tự kiểm tra biến môi trường, build image, khởi động stack và chờ
`/api/health` trả `ok`. Khi xong:

```bash
curl -s https://ptc-bonus.com/api/health
# {"ok":true,"db":"up","latencyMs":3}
```

### 6. Tài khoản đầu tiên

Mở `https://ptc-bonus.com/register` và đăng ký chủ nhà hàng đầu tiên. Schema DB
đã được container app tự áp dụng lúc khởi động (`prisma db push`), không cần
chạy migration thủ công.

> Image production chỉ chứa dependency runtime nên không chạy được
> `prisma db seed` (cần `tsx`). Dữ liệu demo chỉ dùng ở máy dev.

### 7. Cron (thay cho Vercel Cron)

```bash
crontab -e
```

```cron
SECRET=<giá trị CRON_SECRET trong .env.production>
0 8 * * * curl -fsS -H "Authorization: Bearer $SECRET" https://ptc-bonus.com/api/cron/birthday >/dev/null
0 9 * * * curl -fsS -H "Authorization: Bearer $SECRET" https://ptc-bonus.com/api/cron/winback  >/dev/null
# Nhắc lịch hẹn: 15 phút một lần, vì mốc "trước 2 tiếng" cần bắn đúng giờ.
*/15 * * * * curl -fsS -H "Authorization: Bearer $SECRET" https://ptc-bonus.com/api/cron/appointment-reminders >/dev/null
# Chấm công: đóng ca nhân viên quên quét ra. Chạy lúc 4h sáng, sau khi quán đã
# đóng cửa hẳn, để không đóng nhầm ca đêm đang còn chạy.
0 4 * * * curl -fsS -H "Authorization: Bearer $SECRET" https://ptc-bonus.com/api/cron/timeclock >/dev/null
30 3 * * * /opt/ptc-bonus/PTC-Loyalty/deploy/backup.sh >> /var/log/ptc-backup.log 2>&1
```

---

## Kết nối WhatsApp cho một nhà hàng

1. Đăng nhập dashboard → **Cài đặt → WhatsApp**.
2. Bấm **Kết nối WhatsApp** → hiện mã QR.
3. Trên điện thoại của nhà hàng: WhatsApp → **Cài đặt → Thiết bị đã liên kết →
   Liên kết thiết bị** → quét.
4. Trạng thái chuyển sang **Đã kết nối**, hiện đúng số của quán.

Sau đó vào **QR đăng ký khách**, in mã QR và đặt lên bàn. Khách quét → nhập tên +
số WhatsApp → nhận ngay lời chào, ảnh QR thành viên và hướng dẫn tích điểm, gửi
từ chính số của quán.

---

## Cập nhật code

```bash
cd /opt/ptc-bonus/PTC-Loyalty
bash deploy/deploy.sh --pull
```

Schema DB được `prisma db push` tự áp dụng khi container app khởi động.

## Vận hành

```bash
cd /opt/ptc-bonus/PTC-Loyalty
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

$COMPOSE ps                      # trạng thái
$COMPOSE logs -f app             # log ứng dụng
$COMPOSE logs -f evolution       # log gateway WhatsApp
$COMPOSE restart app
docker stats --no-stream         # RAM/CPU thực tế
ufw status verbose
fail2ban-client status sshd
```

Xem các phiên WhatsApp đang chạy:

```bash
$COMPOSE exec evolution sh -c 'wget -qO- --header="apikey: $AUTHENTICATION_API_KEY" http://127.0.0.1:8080/instance/fetchInstances'
```

## Sao lưu

`deploy/backup.sh` dump cả hai database và đóng gói thư mục session của Baileys.

**Mất dữ liệu session = mọi nhà hàng phải quét lại QR.** Bật thêm snapshot tự
động của OVHcloud, và mở `deploy/backup.sh` để bật dòng `rclone` đẩy bản sao ra
ngoài — backup nằm cùng ổ đĩa không sống sót khi ổ chết.

## Sự cố thường gặp

**`init-ssl.sh` báo lỗi challenge.** DNS chưa trỏ đúng, hoặc cổng 80 bị chặn.
Kiểm tra cả `ufw status` lẫn tường lửa mức mạng trong OVHcloud Control Panel.

**Quét QR WhatsApp mãi không kết nối.** `WA_WEB_VERSION` trong
`.env.production` đã cũ so với bản WhatsApp Web thật. Nâng số đó rồi
`$COMPOSE up -d evolution`.

**Một nhà hàng bị rớt kết nối.** WhatsApp tự ngắt thiết bị liên kết khi điện
thoại chủ quán offline quá lâu (~14 ngày). Trang Cài đặt → WhatsApp tự phát hiện
và hiện lại QR để quét lại.

**Khách đăng ký nhưng không nhận được tin.** Kiểm tra trạng thái kết nối của quán
đó; trang QR đăng ký sẽ cảnh báo sẵn nếu chưa ghép số. Khách vẫn thấy mã QR trên
màn hình nên không mất lượt đăng ký.

**App không khởi động.** `$COMPOSE logs app` — thường là `DATABASE_URL` sai hoặc
thiếu biến bắt buộc; entrypoint sẽ dừng hẳn thay vì chạy nửa vời.
