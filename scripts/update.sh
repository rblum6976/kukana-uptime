#!/usr/bin/env bash
set -euo pipefail

# Update running Kukana-Uptime stack (rebuild and recreate containers with minimal downtime)

cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE_FILE=docker-compose.prod.yml

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found." >&2
  exit 1
fi

echo "Pulling images (if using registry) and rebuilding local image..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull

echo "Recreating containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "Update complete."
