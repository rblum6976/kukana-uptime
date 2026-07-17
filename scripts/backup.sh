#!/usr/bin/env bash
set -euo pipefail

# Create a timestamped backup of the uptime SQLite database from the running container

cd "$(dirname "$0")/.."

BACKUP_DIR=${1:-backups}
CONTAINER=${2:-kukana-uptime}
DB_PATH_IN_CONTAINER=/app/data/uptime.db

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/uptime-$STAMP.db"

echo "Copying database from container $CONTAINER..."
docker cp "$CONTAINER:$DB_PATH_IN_CONTAINER" "$OUT"
echo "Backup created at $OUT"
