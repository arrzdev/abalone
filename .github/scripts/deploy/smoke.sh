#!/usr/bin/env bash
# Post-deploy smoke check (deploy.yml `smoke`): the site answers its home page
# and the API answers its health probe with the success envelope. Each check
# gets 3 attempts 10s apart (a fresh version can take a few seconds to reach
# every edge); one failing check fails the run.
#
# Reads SITE_URL (the product origin; the API is a path on it: /api/v1/health).
# Unset: warns and passes. CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET,
# when set, pass Cloudflare Access (staging).
set -euo pipefail

site="${SITE_URL:-}"
if [ -z "$site" ]; then
  echo "::warning::SITE_URL is not set on this Environment, the smoke check was skipped"
  exit 0
fi
site="${site%/}"

headers=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ]; then
  headers=(-H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET:?CF_ACCESS_CLIENT_SECRET env required}")
fi

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

# check <url> <text the 200 body must contain>
check() {
  local url="$1" expect="$2" status
  for attempt in 1 2 3; do
    status="$(curl -sS --max-time 15 -o "$body_file" -w '%{http_code}' "${headers[@]}" "$url" || echo 000)"
    if [ "$status" = 200 ] && grep -qF "$expect" "$body_file"; then
      echo "ok ${url} -> ${status}"
      return 0
    fi
    echo "attempt ${attempt}: ${url} -> ${status}"
    [ "$attempt" = 3 ] || sleep 10
  done
  echo "::error::${url} did not answer 200 with '${expect}' after 3 attempts"
  return 1
}

failed=0
check "${site}/" "<html" || failed=1
check "${site}/api/v1/health" '"status":"success"' || failed=1
exit "$failed"
