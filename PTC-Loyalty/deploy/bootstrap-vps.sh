#!/usr/bin/env bash
# One-time hardening + Docker install for the OVHcloud VPS.
# Run as root:  bash deploy/bootstrap-vps.sh
#
# Installs ONLY Docker on the host — the application, database, cache and
# WhatsApp gateway all run in containers.

set -euo pipefail

log() { echo -e "\n\033[1;36m▶ $*\033[0m"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Chạy bằng root: sudo bash $0" >&2
  exit 1
fi

log "Cập nhật hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades

log "Cài Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

log "Giới hạn log của Docker (tránh đầy ổ)"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
JSON
systemctl restart docker

log "Swap 4 GB (đệm an toàn khi nhiều phiên WhatsApp cùng hoạt động)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Ưu tiên RAM thật, chỉ dùng swap khi thực sự cần.
sysctl -w vm.swappiness=10 >/dev/null
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

log "Tường lửa UFW: chỉ mở 22, 80, 443"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status verbose

log "Fail2Ban cho SSH"
cat > /etc/fail2ban/jail.local <<'INI'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd
destemail = root@localhost

[sshd]
enabled = true
port    = 22
maxretry = 4
bantime = 4h
INI
systemctl enable --now fail2ban
systemctl restart fail2ban

log "Bật cập nhật bảo mật tự động"
dpkg-reconfigure -f noninteractive unattended-upgrades

log "XONG"
cat <<'TXT'

Tiếp theo:
  1) Đưa source lên /opt/ptc-bonus  (git clone hoặc rsync)
  2) cd /opt/ptc-bonus
  3) cp .env.production.example .env.production && nano .env.production
  4) bash deploy/init-ssl.sh
  5) bash deploy/deploy.sh

TXT
