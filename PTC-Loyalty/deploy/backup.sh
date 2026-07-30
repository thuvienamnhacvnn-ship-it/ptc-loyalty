#!/usr/bin/env bash
# Daily backup: application database + WhatsApp session state.
#
# Losing the WhatsApp session data means EVERY restaurant has to scan a new
# login QR — it is the most valuable state on this server.
#
# Install (as root, from the project directory):
#   chmod +x deploy/backup.sh
#   (crontab -l 2>/dev/null; echo "30 3 * * * /opt/ptc-bonus/deploy/backup.sh >> /var/log/ptc-backup.log 2>&1") | crontab -

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ptc-bonus}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# 1) Application data.
$COMPOSE exec -T postgres pg_dump -U ptc -d ptc_bonus \
  | gzip > "$BACKUP_DIR/app-$STAMP.sql.gz"

# 2) WhatsApp gateway: instances, credentials, per-instance API keys.
$COMPOSE exec -T postgres pg_dump -U ptc -d evolution \
  | gzip > "$BACKUP_DIR/evolution-db-$STAMP.sql.gz"

# 3) Baileys auth files on disk.
docker run --rm \
  -v ptc-bonus_evolution_instances:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/evolution-instances-$STAMP.tar.gz" -C /data .

find "$BACKUP_DIR" -type f -name '*.gz' -mtime "+$KEEP_DAYS" -delete

echo "[$(date -Is)] backup ok → $BACKUP_DIR (giữ $KEEP_DAYS ngày)"

# Off-site copy — a backup on the same disk does not survive a dead disk.
# Configure with `rclone config`, then uncomment:
# rclone copy "$BACKUP_DIR" remote:ptc-bonus-backup --max-age 25h
