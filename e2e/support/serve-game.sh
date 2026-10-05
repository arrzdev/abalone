#!/usr/bin/env bash
# Starts the game for the e2e suite: a build in `e2e` mode, served by
# `vite preview`, so the specs run against bundled code the way players get it.
#
# Not the dev server: it compiles on demand and, with a few browsers asking at
# once, now and then fails a page's import of the client entry, which leaves
# the page blank. Not the production build either: `e2e` mode is what puts the
# board probe in (apps/game/src/test-support/board-probe.ts).
#
# The build goes to dist/, like any other; the deploy builds its own.
set -euo pipefail

game_port="${E2E_GAME_PORT:?}"
api_port="${E2E_API_PORT:?}"

cd "$(dirname "$0")/../../apps/game"

# An e2e build calls the backend on its own port, like dev does
# (src/data/backend-client.ts). A VITE_ variable in the environment beats
# env/.env, and a clean checkout has no env/.env at all.
export VITE_BACKEND_URL="http://localhost:${api_port}"

pnpm exec vite build --mode e2e

exec pnpm exec vite preview --mode e2e \
  --host localhost \
  --port "$game_port" \
  --strictPort
