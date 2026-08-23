#!/usr/bin/env bash
set -euo pipefail

VM_HOST="${VM_HOST:-root@165.227.2.163}"
APP_DIR="${APP_DIR:-/opt/apps/geschenk25}"
KNOWN_HOSTS_FILE="${KNOWN_HOSTS_FILE:-}"
DEPLOY_LOCK_WAIT_SECONDS="${DEPLOY_LOCK_WAIT_SECONDS:-300}"
DEPLOY_LOCK_POLL_SECONDS=5

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_CMD=(ssh)
RSYNC_SSH=(ssh)
LOCK_DIR="$APP_DIR/.deploy.lock"
LOCK_ACQUIRED=false

if [[ -n "$KNOWN_HOSTS_FILE" ]]; then
  SSH_CMD+=(-o "UserKnownHostsFile=$KNOWN_HOSTS_FILE")
  RSYNC_SSH+=(-o "UserKnownHostsFile=$KNOWN_HOSTS_FILE")
fi

echo "Deploying Geschenk to $VM_HOST"

"${SSH_CMD[@]}" "$VM_HOST" "mkdir -p '$APP_DIR'"

cleanup_lock() {
  if [[ "$LOCK_ACQUIRED" == true ]]; then
    "${SSH_CMD[@]}" "$VM_HOST" "rmdir '$LOCK_DIR' >/dev/null 2>&1 || true"
  fi
}
trap cleanup_lock EXIT

for elapsed in $(seq 0 "$DEPLOY_LOCK_POLL_SECONDS" "$DEPLOY_LOCK_WAIT_SECONDS"); do
  if "${SSH_CMD[@]}" "$VM_HOST" "mkdir '$LOCK_DIR' 2>/dev/null"; then
    LOCK_ACQUIRED=true
    break
  fi

  if [[ "$elapsed" -ge "$DEPLOY_LOCK_WAIT_SECONDS" ]]; then
    echo "Timed out waiting for another Geschenk deploy to finish." >&2
    exit 1
  fi

  echo "Another Geschenk deploy is running; waiting..."
  sleep "$DEPLOY_LOCK_POLL_SECONDS"
done

rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude apps/api/.env \
  --exclude apps/api/.env.* \
  --exclude apps/web/.env \
  --exclude apps/web/.env.* \
  --exclude deploy/.env \
  --exclude .DS_Store \
  -e "${RSYNC_SSH[*]}" \
  "$ROOT_DIR/" "$VM_HOST:$APP_DIR/"

"${SSH_CMD[@]}" "$VM_HOST" "set -euo pipefail
cd '$APP_DIR/deploy'
if [ ! -f .env ]; then
  cp .env.example .env
  echo 'Created .env from .env.example. Fill secrets, then rerun this script.' >&2
  exit 2
fi
docker network inspect web >/dev/null 2>&1 || docker network create web
docker compose up -d --build
for i in \$(seq 1 60); do
  api_id=\$(docker compose ps -q geschenk-api)
  api_status=\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \"\$api_id\")
  if [ \"\$api_status\" = healthy ]; then
    break
  fi
  sleep 1
done
docker compose ps
docker compose exec -T geschenk-api node -e \"fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"
"

echo "Deployed: https://geschenk.mteschke.com"
