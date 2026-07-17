#!/usr/bin/env bash
set -euo pipefail

# Deploy Kukana-Uptime in production using docker-compose.prod.yml
# - Builds the image (if not present)
# - Starts app and cloudflared

cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE_FILE=docker-compose.prod.yml

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Copy .env.prod and fill in required values." >&2
  exit 1
fi

echo "Building kukana-uptime image..."
APP_VERSION=$(grep -E '^APP_VERSION=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
APP_VERSION=${APP_VERSION:-latest}

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "Starting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "Deployment complete."
echo "- App URL via tunnel: your Cloudflare public hostname"
echo "- Local port mapping: http://localhost:3333"
