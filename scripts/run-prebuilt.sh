#!/usr/bin/env bash
set -euo pipefail

# Run Kukana-Uptime using a PREBUILT Docker image (no build step).
#
# Usage examples:
#   ./scripts/run-prebuilt.sh                           # use defaults from .env.prod (APP_VERSION) → kukana-uptime:<APP_VERSION>-amd64
#   KUKANA_IMAGE=my-registry/kukana-uptime:1.1.0-amd64 \
#     ./scripts/run-prebuilt.sh                         # explicit image via env var
#   ./scripts/run-prebuilt.sh kukana-uptime:1.1.0-amd64 # explicit image via arg
#   ./scripts/run-prebuilt.sh ./kukana-uptime-1.1.0-amd64.tar  # load tarball, then run (image name must be available/tagged)

cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE_FILE=docker-compose.prod.run.yml

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Create and fill it first (see README)." >&2
  exit 1
fi

ARG_INPUT=${1:-}

# If an argument points to a tarball file, load it first.
if [[ -n "$ARG_INPUT" && -f "$ARG_INPUT" && "$ARG_INPUT" == *.tar ]]; then
  echo "Loading image tarball: $ARG_INPUT"
  docker load -i "$ARG_INPUT"
  # After loading, ensure KUKANA_IMAGE is set externally or via .env.prod (APP_VERSION)
  ARG_INPUT=""
fi

# If an argument looks like an image reference, use it as KUKANA_IMAGE.
if [[ -n "$ARG_INPUT" ]]; then
  export KUKANA_IMAGE="$ARG_INPUT"
fi

echo "Starting prebuilt stack using $COMPOSE_FILE ..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "Done. Access locally at http://localhost:3333 or via your Cloudflare Tunnel hostname."
