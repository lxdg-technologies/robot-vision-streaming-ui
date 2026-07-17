#!/usr/bin/env bash
set -euo pipefail

image=${1:?Usage: test-container.sh IMAGE}
container="streaming-ui-smoke-${RANDOM}"
sentinel_url="http://runtime-smoke.invalid"

cleanup() {
  local status=$?
  if [[ ${status} -ne 0 ]]; then
    docker logs "${container}" >&2 || true
  fi
  docker rm --force "${container}" >/dev/null 2>&1 || true
  trap - EXIT
  exit "${status}"
}
trap cleanup EXIT

docker run \
  --detach \
  --name "${container}" \
  --env "PUBLIC_CAMERA_API_URL=${sentinel_url}" \
  --publish 127.0.0.1:5173:5173 \
  "${image}" >/dev/null

html=$(curl \
  --fail \
  --silent \
  --show-error \
  --retry 15 \
  --retry-all-errors \
  --retry-connrefused \
  --retry-delay 1 \
  http://127.0.0.1:5173/)

grep -Fq "${sentinel_url}" <<< "${html}"
echo "Production container smoke test passed."
