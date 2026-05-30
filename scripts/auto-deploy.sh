#!/usr/bin/env sh
set -eu

DEPLOY_DIR="${DEPLOY_DIR:-/opt/complass-frontend}"
IMAGE_NAME="${IMAGE_NAME:-complass-frontend:latest}"
LOCK_FILE="${LOCK_FILE:-/tmp/complass-frontend-deploy.lock}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:80/}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die()  { log "FATAL: $*" >&2; exit 1; }

# ---- concurrency guard ----
if [ -f "${LOCK_FILE}" ]; then
    pid="$(cat "${LOCK_FILE}")"
    if kill -0 "${pid}" 2>/dev/null; then
        log "Another deployment (pid=${pid}) is running, aborting."
        exit 0
    fi
    log "Stale lock file found (pid=${pid} is gone), removing."
    rm -f "${LOCK_FILE}"
fi
echo $$ > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"' EXIT INT TERM HUP

cd "${DEPLOY_DIR}"

log "Fetching origin/dev..."
git fetch origin dev

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/dev)"

if [ "${LOCAL_HEAD}" = "${REMOTE_HEAD}" ]; then
    log "Already up to date: ${LOCAL_HEAD}"
    exit 0
fi

log "New commits: ${LOCAL_HEAD} -> ${REMOTE_HEAD}"

# Snapshot the currently running image ID for possible rollback.
OLD_IMAGE_ID="$(docker inspect --format='{{.Image}}' complass-frontend 2>/dev/null || true)"

git pull --ff-only origin dev

log "Building image..."
docker build -t "${IMAGE_NAME}" .

log "Redeploying frontend container..."
docker compose up -d

log "Waiting for frontend to become healthy..."
if curl -fsS --max-time 10 --retry 3 --retry-delay 2 "${HEALTH_URL}"; then
    echo
    log "Deploy succeeded."
    docker compose ps

    docker image prune -f 2>/dev/null || true
else
    echo
    log "Health check failed, rolling back..."
    if [ -n "${OLD_IMAGE_ID}" ]; then
        docker tag "${OLD_IMAGE_ID}" "${IMAGE_NAME}" 2>/dev/null || true
        docker compose up -d
        log "Rolled back to ${OLD_IMAGE_ID}"
    else
        log "No previous image to roll back to."
    fi
    die "Deploy failed: health check returned non-zero."
fi
