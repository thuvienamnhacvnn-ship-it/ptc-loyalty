#!/usr/bin/env bash
# Build and (re)start the whole production stack. Safe to re-run for updates.
#
#   bash deploy/deploy.sh          # build + up
#   bash deploy/deploy.sh --pull   # also git pull first

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.production"

# Máy chủ này còn chạy vài service KHÔNG thuộc repo (ví dụ media engine), khai
# trong các file compose phụ nhưng CÙNG project `ptc-bonus`. Bên dưới có
# `up -d --remove-orphans`, mà với compose thì "orphan" = container thuộc project
# này nhưng không có mặt trong các file `-f` được truyền vào. Bỏ sót một file phụ
# là deploy XOÁ SẠCH service đó — đã suýt xảy ra ngày 21/08/2026.
# Nên: nạp mọi `docker-compose.*.yml` tìm thấy, đừng cứng nhắc một file.
COMPOSE_FILES="-f docker-compose.prod.yml"
for extra in docker-compose.*.yml; do
  case "$extra" in
    docker-compose.prod.yml | docker-compose.yml | "docker-compose.*.yml") continue ;;
  esac
  COMPOSE_FILES="$COMPOSE_FILES -f $extra"
  echo "  + nạp thêm file compose phụ: $extra"
done
COMPOSE="docker compose --env-file $ENV_FILE $COMPOSE_FILES"

log() { echo -e "\n\033[1;36m▶ $*\033[0m"; }

[ -f "$ENV_FILE" ] || { echo "Thiếu $ENV_FILE — copy từ .env.production.example" >&2; exit 1; }

# Fail fast on placeholder secrets rather than booting an insecure stack.
log "Kiểm tra biến môi trường"
missing=0
for key in DATABASE_URL POSTGRES_PASSWORD AUTH_SECRET QR_SIGNING_SECRET ENCRYPTION_KEY POS_JWT_SECRET EVOLUTION_API_KEY NEXT_PUBLIC_APP_URL ACME_EMAIL; do
  value="$(grep -E "^$key=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)"
  if [ -z "$value" ] || echo "$value" | grep -qi 'replace-me\|changeme\|^$'; then
    echo "  ✗ $key chưa được đặt"
    missing=1
  else
    echo "  ✓ $key"
  fi
done
[ "$missing" -eq 0 ] || { echo "Điền đủ các biến trên rồi chạy lại." >&2; exit 1; }

if [ "${1:-}" = "--pull" ]; then
  log "Lấy code mới"
  git pull --ff-only
fi

log "Kéo image nền"
$COMPOSE pull nginx certbot postgres redis evolution

log "Build image ứng dụng"
# Phải build CẢ `migrate`: nó là image riêng (ptc-bonus-migrate, stage build) và
# chính nó chạy `prisma db push`. Chỉ build `app` thì migrate vẫn ôm schema cũ,
# báo "already in sync" rồi bảng mới không bao giờ được tạo trên prod.
$COMPOSE build app migrate

# conf.d được bind-mount từ thư mục này, nên container nginx đang chạy ĐÃ nhìn
# thấy file vừa `git pull` về, chỉ là chưa nạp. Kiểm ngay tại đó là cách rẻ nhất
# để bắt lỗi cú pháp trước khi dựng lại — cấu hình hỏng mà cứ `up -d` thì nginx
# chết và cả site đi theo. Nginx chưa chạy thì bỏ qua (lần deploy đầu tiên).
if $COMPOSE ps --status running nginx 2>/dev/null | grep -q nginx; then
  log "Kiểm cấu hình nginx"
  if ! $COMPOSE exec -T nginx nginx -t; then
    echo "  ✗ Cấu hình nginx sai — DỪNG, site vẫn đang chạy bản cũ." >&2
    exit 1
  fi
fi

log "Khởi động stack"
$COMPOSE up -d --remove-orphans

# `up -d` chỉ dựng lại container khi CẤU HÌNH COMPOSE đổi. File nginx nằm trong
# bind mount conf.d, đổi nội dung nó thì compose không thấy gì khác nên nginx
# giữ nguyên cấu hình đã nạp trong bộ nhớ — sửa nginx xong deploy mà chẳng có
# tác dụng gì, im lặng. Đã dính đúng vậy ngày 21/08/2026 với block
# /media-engine/. Reload là thao tác rẻ và không rớt kết nối, cứ làm mỗi lần.
if $COMPOSE ps --status running nginx 2>/dev/null | grep -q nginx; then
  log "Nạp lại cấu hình nginx"
  $COMPOSE exec -T nginx nginx -s reload && echo "  đã nạp lại"
fi

log "Chờ ứng dụng sẵn sàng"
for i in $(seq 1 60); do
  if $COMPOSE exec -T app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q '"ok":true'; then
    echo "  app đã sẵn sàng sau ${i}0s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "  app không phản hồi — xem log:" >&2
    $COMPOSE logs --tail 80 app >&2
    exit 1
  fi
  sleep 10
done

log "Dọn image cũ"
docker image prune -f >/dev/null

log "Trạng thái"
$COMPOSE ps

cat <<TXT

✅ https://ptc-bonus.com đã chạy.

Kiểm tra nhanh:
  curl -s https://ptc-bonus.com/api/health

Lệnh thường dùng:
  $COMPOSE logs -f app
  $COMPOSE logs -f evolution
  $COMPOSE restart app
  docker stats --no-stream

TXT
