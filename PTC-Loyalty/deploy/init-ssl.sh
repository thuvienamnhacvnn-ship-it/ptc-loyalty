#!/usr/bin/env bash
# First-time Let's Encrypt certificate for ptc-bonus.com (+ www).
#
# nginx refuses to start without a certificate file, and certbot needs nginx to
# answer the ACME challenge — so: put a temporary self-signed cert in place,
# start nginx, get the real one, swap it in, reload. Run ONCE, before deploy.sh.
#
#   bash deploy/init-ssl.sh

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.production"
COMPOSE="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"

[ -f "$ENV_FILE" ] || { echo "Thiếu $ENV_FILE — copy từ .env.production.example" >&2; exit 1; }

DOMAIN="${DOMAIN:-ptc-bonus.com}"
EMAIL="$(grep -E '^ACME_EMAIL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)"
[ -n "$EMAIL" ] || { echo "Thiếu ACME_EMAIL trong $ENV_FILE" >&2; exit 1; }

log() { echo -e "\n\033[1;36m▶ $*\033[0m"; }

resolve() {
  getent hosts "$1" 2>/dev/null | awk '{print $1}' | head -1 && return 0
  command -v dig >/dev/null && dig +short "$1" A | tail -1
}

log "Kiểm tra DNS"
RESOLVED="$(resolve "$DOMAIN")"
echo "$DOMAIN → ${RESOLVED:-KHÔNG PHÂN GIẢI ĐƯỢC}"
if [ -z "$RESOLVED" ]; then
  echo "DNS chưa trỏ về VPS. Tạo bản ghi A rồi chạy lại." >&2
  exit 1
fi

# Let's Encrypt validates EVERY name in the request: asking for a www that has
# no DNS record fails the whole certificate, apex included.
WWW_IP="$(resolve "www.$DOMAIN")"
if [ -n "$WWW_IP" ]; then
  CERT_DOMAINS=(-d "$DOMAIN" -d "www.$DOMAIN")
  echo "www.$DOMAIN → $WWW_IP"
else
  CERT_DOMAINS=(-d "$DOMAIN")
  echo "www.$DOMAIN → chưa có bản ghi, cấp chứng chỉ cho riêng $DOMAIN"
fi

log "Tạo chứng chỉ tạm (self-signed) để nginx khởi động được"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
$COMPOSE run --rm --entrypoint sh certbot -c "
  mkdir -p '$CERT_PATH' &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=$DOMAIN'"

# --no-deps: nginx resolves the app upstream per request, so it starts fine on
# its own and can answer the ACME challenge before anything else is built.
log "Khởi động nginx"
$COMPOSE up -d --no-deps nginx
sleep 5

log "Kiểm tra nginx phục vụ được thư mục ACME"
$COMPOSE exec -T nginx nginx -t

# certbot refuses to write into a live/ directory it did not create, and the
# self-signed placeholder above is exactly that. nginx already holds the old
# files open, so removing them now costs nothing.
log "Dọn chứng chỉ tạm"
$COMPOSE run --rm --entrypoint sh certbot -c "
  rm -rf '/etc/letsencrypt/live/$DOMAIN' \
         '/etc/letsencrypt/archive/$DOMAIN' \
         '/etc/letsencrypt/renewal/$DOMAIN.conf'"

log "Xin chứng chỉ thật từ Let's Encrypt"
$COMPOSE run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email --force-renewal \
  "${CERT_DOMAINS[@]}"

log "Nạp lại nginx với chứng chỉ thật"
$COMPOSE exec -T nginx nginx -s reload

log "XONG — chứng chỉ đã sẵn sàng. Chạy tiếp: bash deploy/deploy.sh"
