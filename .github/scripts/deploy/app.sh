#!/usr/bin/env bash
# Generic per-app deploy. The pipeline is uniform across apps; the only
# variations are *derived*, never configured:
#   - build emits dist/server/wrangler.json (TanStack)  -> deploy --config that
#   - wrangler.toml has a D1 binding                     -> versioned: upload -> migrate -> promote
#   - otherwise                                          -> plain one-shot deploy
# This project deploys ONE environment: production off `main`. So there is no
# `--env` and no worker-name suffix — the wrangler `name` IS the worker. D1
# database name(s) are read from the app's wrangler.toml via wrangler's own config
# reader (see d1-databases.ts), never derived from the worker name, and every
# configured database is migrated. Adding a second environment means restoring the
# `--env` flag and the per-env name here; `stack-deploy-environments` keeps that shape.
# DRY_RUN=1 prints the wrangler commands without running anything (still reads the config).
set -euo pipefail

app_path="${1:?usage: app.sh <app-path>}"

# absolute path to this script's directory, captured before any `cd` so the helper resolves
script_dir="$(cd "$(dirname "$0")" && pwd)"

if [ "${DRY_RUN:-}" != "1" ]; then
  pnpm tsx .github/scripts/write-env-from-schema.ts "$app_path"
  # Enforce env presence HERE — deploy time, with the real secrets+vars. The
  # `build` script no longer runs check:env, so PR CI never gates on env; a
  # missing required var fails the DEPLOY (this line), not the PR build.
  (cd "$app_path" && pnpm check:env && pnpm run build)
fi

cd "$app_path"

worker="$(grep -m1 '^name = ' wrangler.toml | sed 's/.*"\(.*\)".*/\1/')"

wr() {
  echo "+ wrangler $*"
  [ "${DRY_RUN:-}" = "1" ] || pnpm exec wrangler "$@"
}

if [ -f dist/server/wrangler.json ]; then
  # generated-config app (e.g. a TanStack Start worker): plain deploy
  wr deploy --config dist/server/wrangler.json --name "$worker"
elif grep -q 'd1_databases' wrangler.toml; then
  # database-backed worker: versioned upload -> migrate -> promote
  # Resolve the ACTUAL D1 database name(s) from wrangler's own config reader (never
  # derived from the worker name). Fails loud if a d1 binding has no database_name,
  # and returns every configured database so a two-database app migrates both.
  if ! db_list="$(pnpm exec tsx "$script_dir/d1-databases.ts")"; then
    echo "::error::${app_path}: could not resolve D1 database name(s) from wrangler config"
    exit 1
  fi
  db_names=()
  while IFS= read -r db_name; do
    [ -n "$db_name" ] && db_names+=("$db_name")
  done <<<"$db_list"
  [ "${#db_names[@]}" -gt 0 ] || {
    echo "::error::${app_path}: wrangler.toml declares d1_databases but none resolved"
    exit 1
  }

  # Upload the env (env/.env, written above from the GH-action env) onto the
  # Worker AS SECRETS, so the runtime env is driven entirely by the deploy — no
  # [vars] in wrangler.toml, no dashboard.
  secrets_file=""
  [ -s env/.env ] && secrets_file="--secrets-file env/.env"
  if [ "${DRY_RUN:-}" = "1" ]; then
    wr versions upload $secrets_file
    vid="<version-id>"
  else
    echo "+ wrangler versions upload $secrets_file"
    # Capture output, but do NOT let `set -e` abort the assignment on a non-zero
    # exit before we can print it — otherwise a failed upload leaves a blank log
    # (this is exactly how a missing binding once failed silently). Surface the
    # wrangler output, check the exit code explicitly, then parse the version id.
    set +e
    upload="$(pnpm exec wrangler versions upload $secrets_file 2>&1)"
    rc=$?
    set -e
    printf '%s\n' "$upload"
    [ "$rc" -eq 0 ] || {
      echo "::error::${app_path}: wrangler versions upload failed (exit ${rc})"
      exit 1
    }
    # vid is scraped from wrangler's "Worker Version ID:" line; if wrangler ever
    # changes that wording this parse yields empty and the guard below fires.
    vid="$(printf '%s\n' "$upload" | grep 'Worker Version ID:' | sed 's/.*Worker Version ID: //' | tr -d '[:space:]')"
    [ -n "$vid" ] || {
      echo "::error::${app_path}: no Worker Version ID from upload"
      exit 1
    }
  fi
  # Migrate every database BEFORE promoting the new version, so the schema is ready
  # the moment the new code goes live.
  for db_name in "${db_names[@]}"; do
    wr d1 migrations apply "$db_name" --remote
  done
  wr versions deploy "${vid}@100%" -y
  # THE VERSIONED PATH DOES NOT APPLY TRIGGERS. `versions upload` + `versions deploy` push
  # only what lives inside a version: code, bindings, secrets. Queue consumers, cron
  # schedules and routes are script-level and are written solely by wrangler's internal
  # triggersDeploy(), reached from `wrangler deploy` and `wrangler triggers deploy` — never
  # from the versioned path. Omitting this makes a DB-backed app deploy GREEN while its
  # queue consumers are never attached (jobs enqueue and are consumed by nobody) and its
  # crons keep whatever schedule they last had.
  # The two non-versioned branches below call `wrangler deploy`, which already does this.
  # Also fails loud when a declared queue is missing — wrangler does not auto-create
  # queues the way it does R2 buckets. The explicit empty `--env=` selects the top-level
  # config, which is the only environment this project has.
  wr triggers deploy --env=
else
  # plain worker: one-shot deploy
  wr deploy --name "$worker"
fi

[ -z "${GITHUB_STEP_SUMMARY:-}" ] ||
  echo "- \`${app_path}\` → **${worker}**" >> "$GITHUB_STEP_SUMMARY"
echo "deployed ${app_path} → ${worker}"
