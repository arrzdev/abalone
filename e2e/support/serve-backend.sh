#!/usr/bin/env bash
# Starts the backend for the e2e suite: the real Worker under `wrangler dev`,
# with local D1, R2 and the PubSub Durable Object, on a state directory of its
# own that is wiped first, so every run starts from an empty database and never
# touches the one `pnpm dev` uses.
#
# Env comes from the committed env/.env.example, never from a local env/.env, so
# the suite runs on a clean checkout and holds no secrets. Only the origins are
# rewritten, to the ports playwright.config.ts picked. They name `localhost`, not
# 127.0.0.1: the backend counts only `localhost` and LAN addresses as a dev
# frontend, and that is what turns on the local avatar route.
set -euo pipefail

game_port="${E2E_GAME_PORT:?}"
api_port="${E2E_API_PORT:?}"
inspector_port="${E2E_API_INSPECTOR_PORT:?}"

cd "$(dirname "$0")/../../apps/backend"

state_dir=".wrangler/e2e"
rm -rf "$state_dir"
mkdir -p "$state_dir"

env_file="$state_dir/.env"
sed \
  -e "s|^FRONTEND_URLS=.*|FRONTEND_URLS=http://localhost:${game_port}|" \
  -e "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=http://localhost:${api_port}|" \
  -e "s|^AVATAR_PUBLIC_URL=.*|AVATAR_PUBLIC_URL=http://localhost:${api_port}/api/v1|" \
  env/.env.example >"$env_file"

pnpm exec wrangler d1 migrations apply abalone-backend-db-dev \
  --local --persist-to "$state_dir"

exec pnpm exec wrangler dev \
  --env-file "$env_file" \
  --persist-to "$state_dir" \
  --ip localhost \
  --port "$api_port" \
  --inspector-port "$inspector_port"
