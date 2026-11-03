#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8080}"
NAME="${NAME:-folia}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker Desktop, then run this script again." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but not running. Start Docker Desktop, then run this script again." >&2
  exit 1
fi

docker build -t folia:local .
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p "${PORT}:80" folia:local >/dev/null
echo "Folia is running at http://localhost:${PORT}"
echo "Stop it with: docker rm -f ${NAME}"
