#!/usr/bin/env bash
# PTC-BONUS — cài đặt production từ đầu đến hết bằng MỘT lệnh.
#
#   curl -fsSL https://raw.githubusercontent.com/thuvienamnhacvnn-ship-it/ptc-loyalty/main/deploy/install.sh | bash
#
# Chạy lại được nhiều lần: mỗi bước tự bỏ qua nếu đã xong. Dùng để cài lần đầu
# và cũng để cập nhật code về sau.
#
# Biến tuỳ chọn:
#   DOMAIN=ptc-bonus.com  ACME_EMAIL=admin@ptc-bonus.com  APP_DIR=/opt/ptc-bonus

set -euo pipefail

DOMAIN="${DOMAIN:-ptc-bonus.com}"
ACME_EMAIL="${ACME_EMAIL:-admin@$DOMAIN}"
APP_DIR="${APP_DIR:-/opt/ptc-bonus}"
REPO="${REPO:-https://github.com/thuvienamnhacvnn-ship-it/ptc-loyalty}"

step() { echo -e "\n\033[1;36m▶ $*\033[0m"; }
ok()   { echo -e "  \033[32m✓\033[0m $*"; }
die()  { echo -e "\n\033[1;31m✗ $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Chạy bằng root."

# ── 0. Kiểm tra trước khi động vào gì ────────────────────────────────────────
step "Kiểm tra máy chủ và DNS"

RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
DISK_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
echo "  RAM: ${RAM_MB} MB · trống: ${DISK_GB} GB · CPU: $(nproc)"
[ "$RAM_MB" -ge 3500 ] || die "Cần tối thiểu 4 GB RAM (đang có ${RAM_MB} MB)."
[ "$DISK_GB" -ge 15 ] || die "Cần tối thiểu 15 GB trống (đang có ${DISK_GB} GB)."

command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl; }
command -v dig  >/dev/null || apt-get install -y -qq dnsutils >/dev/null 2>&1 || true

MY_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
DNS_IP="$(dig +short "$DOMAIN" A | tail -1 || true)"
echo "  IP máy chủ : ${MY_IP:-không xác định được}"
echo "  DNS $DOMAIN → ${DNS_IP:-chưa phân giải}"

if [ -z "$DNS_IP" ]; then
  die "DNS chưa trỏ. Tạo bản ghi A: @ → $MY_IP và www → $MY_IP, đợi vài phút rồi chạy lại."
fi
if [ -n "$MY_IP" ] && [ "$DNS_IP" != "$MY_IP" ]; then
  die "DNS đang trỏ về $DNS_IP nhưng máy này là $MY_IP. Sửa bản ghi A rồi chạy lại."
fi
ok "DNS đã trỏ đúng"

# ── 1. Chuẩn bị hệ thống ─────────────────────────────────────────────────────
step "Cài Docker + gia cố hệ thống"
command -v git >/dev/null || { apt-get update -qq; apt-get install -y -qq git; }

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin main
  git -C "$APP_DIR" reset --hard --quiet origin/main
  ok "đã cập nhật code trong $APP_DIR"
else
  git clone --quiet "$REPO" "$APP_DIR"
  ok "đã tải code về $APP_DIR"
fi

cd "$APP_DIR"
bash deploy/bootstrap-vps.sh

# ── 2. Bí mật ────────────────────────────────────────────────────────────────
step "Chuẩn bị biến môi trường"
if [ -f .env.production ]; then
  ok ".env.production đã có — giữ nguyên (không sinh lại khóa)"
else
  bash deploy/gen-env.sh "$ACME_EMAIL"
fi

# ── 3. Chứng chỉ TLS ─────────────────────────────────────────────────────────
step "Chứng chỉ TLS"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
LIVE="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

# Chứng chỉ thật do Let's Encrypt cấp; bản tự ký tạm của init-ssl.sh thì không tính.
ISSUER="$($COMPOSE run --rm --no-deps --entrypoint sh certbot -c \
  "openssl x509 -noout -issuer -in $LIVE 2>/dev/null || true" 2>/dev/null | tr -d '\r' || true)"

if echo "$ISSUER" | grep -qi "let's encrypt"; then
  ok "đã có chứng chỉ Let's Encrypt — bỏ qua"
else
  bash deploy/init-ssl.sh
fi

# ── 4. Khởi động ─────────────────────────────────────────────────────────────
bash deploy/deploy.sh

# ── 5. Kiểm tra từ ngoài vào ─────────────────────────────────────────────────
step "Kiểm tra qua HTTPS công khai"
sleep 3
HEALTH="$(curl -fsS --max-time 20 "https://$DOMAIN/api/health" || true)"
if echo "$HEALTH" | grep -q '"ok":true'; then
  ok "https://$DOMAIN/api/health → $HEALTH"
else
  echo "  ⚠️  Chưa gọi được qua HTTPS: ${HEALTH:-không phản hồi}"
  echo "     Xem log: cd $APP_DIR && $COMPOSE logs --tail 60 nginx app"
  exit 1
fi

cat <<TXT

════════════════════════════════════════════
 ✅ https://$DOMAIN đã chạy production
════════════════════════════════════════════

Tiếp theo, trên trình duyệt:
  1. https://$DOMAIN/register        → tạo tài khoản chủ nhà hàng
  2. Cài đặt → WhatsApp → Kết nối    → quét QR bằng điện thoại của quán
  3. QR đăng ký khách → In           → đặt lên bàn

Sao lưu (rất nên làm ngay):
  cp $APP_DIR/.env.production ~/ptc-env-backup.txt
  crontab -e   →   30 3 * * * $APP_DIR/deploy/backup.sh >> /var/log/ptc-backup.log 2>&1

Cập nhật về sau: chạy lại đúng lệnh cài đặt này.

TXT
