#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE_FILE=docker-compose.prod.yml

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
