#!/usr/bin/env bash
# Generate .env.production with fresh random secrets.
#
# Nothing has to be typed or pasted by hand — every key is created with
# `openssl rand` right on the server, so no secret ever travels through a
# clipboard, a chat window or a terminal scrollback.
#
#   bash deploy/gen-env.sh                      # dùng email mặc định
#   bash deploy/gen-env.sh admin@ptc-bonus.com  # chỉ định email Let's Encrypt

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.production"
ACME_EMAIL="${1:-admin@ptc-bonus.com}"
APP_URL="${APP_URL:-https://ptc-bonus.com}"

if [ -f "$ENV_FILE" ]; then
  echo "⚠️  $ENV_FILE đã tồn tại — không ghi đè."
  echo "    Muốn tạo mới: mv $ENV_FILE $ENV_FILE.bak && bash $0 $ACME_EMAIL"
  echo
  echo "    LƯU Ý: đổi POSTGRES_PASSWORD sau khi DB đã chạy sẽ làm app mất kết nối."
  exit 1
fi

command -v openssl >/dev/null || { echo "Thiếu openssl: apt install -y openssl" >&2; exit 1; }

b64() { openssl rand -base64 32 | tr -d '\n'; }
hex() { openssl rand -hex "$1" | tr -d '\n'; }

# Generated once so the app URL and the postgres URL agree on the password.
PG_PASSWORD="$(hex 24)"

cat > "$ENV_FILE" <<EOF
# Sinh tự động bởi deploy/gen-env.sh — $(date -Is)
# KHÔNG commit file này. Sao lưu ở nơi an toàn: mất ENCRYPTION_KEY nghĩa là
# mọi nhà hàng phải quét lại mã QR WhatsApp.

NEXT_PUBLIC_APP_URL="$APP_URL"
ACME_EMAIL="$ACME_EMAIL"

POSTGRES_PASSWORD="$PG_PASSWORD"

# Database dùng cho app. Mặc định là postgres chạy trong stack này.
# Đang có dữ liệu ở nơi khác (Neon, RDS…)? Thay bằng chuỗi kết nối đó để giữ
# nguyên dữ liệu — postgres nội bộ vẫn phục vụ gateway WhatsApp.
DATABASE_URL="postgresql://ptc:$PG_PASSWORD@postgres:5432/ptc_bonus?connection_limit=10&pool_timeout=20"

AUTH_SECRET="$(b64)"
QR_SIGNING_SECRET="$(b64)"
ENCRYPTION_KEY="$(b64)"
POS_JWT_SECRET="$(b64)"
CRON_SECRET="$(hex 32)"

EVOLUTION_API_KEY="$(hex 32)"
EVOLUTION_IMAGE="evoapicloud/evolution-api:v2.3.7"
WA_WEB_VERSION="2.3000.1023204200"
EOF

chmod 600 "$ENV_FILE"

echo "✅ Đã tạo $ENV_FILE (chmod 600)"
echo
echo "   Domain          : $APP_URL"
echo "   Email TLS       : $ACME_EMAIL"
echo "   Secrets         : 7 khóa đã sinh ngẫu nhiên"
echo
echo "Tiếp theo:"
echo "   bash deploy/init-ssl.sh"
echo "   bash deploy/deploy.sh"
