#!/usr/bin/env bash
# Build and (re)start the whole production stack. Safe to re-run for updates.
#
#   bash deploy/deploy.sh          # build + up
#   bash deploy/deploy.sh --pull   # also git pull first

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.production"
COMPOSE="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"

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

log "Khởi động stack"
$COMPOSE up -d --remove-orphans

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
