#!/usr/bin/env bash
set -euo pipefail

# Build and Publish Kukana-Uptime to the local docker registry

cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE_FILE=docker-compose.prod.yml

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Copy .env.prod and fill in required values." >&2
  exit 1
fi

# Load variables from .env.prod
REGISTRY_URL=$(grep -E '^REGISTRY_URL=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d '\r')
APP_VERSION=$(grep -E '^APP_VERSION=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d '\r')
APP_VERSION=${APP_VERSION:-latest}
REGISTRY_URL=${REGISTRY_URL:-localhost:5000}

# Optional architecture (e.g. amd64)
ARCH=${1:-""}

IMAGE_NAME="kukana-uptime"
TAG_SUFFIX=""

if [[ -n "$ARCH" ]]; then
  echo "Targeting architecture: $ARCH"
  export DOCKER_DEFAULT_PLATFORM="linux/$ARCH"
  TAG_SUFFIX="-$ARCH"
fi

REGISTRY_IMAGE="${REGISTRY_URL}/${IMAGE_NAME}:${APP_VERSION}${TAG_SUFFIX}"
REGISTRY_IMAGE_LATEST="${REGISTRY_URL}/${IMAGE_NAME}:latest${TAG_SUFFIX}"

echo "Building ${REGISTRY_IMAGE}..."
APP_VERSION="${APP_VERSION}${TAG_SUFFIX}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "Tagging latest for registry..."
docker tag "${REGISTRY_IMAGE}" "${REGISTRY_IMAGE_LATEST}"

echo "Pushing images to ${REGISTRY_URL}..."
docker push "${REGISTRY_IMAGE}"
docker push "${REGISTRY_IMAGE_LATEST}"

echo "Publish complete: ${REGISTRY_IMAGE}"
