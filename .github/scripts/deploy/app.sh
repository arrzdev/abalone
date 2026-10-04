#!/usr/bin/env bash
# Generic per-app deploy. The pipeline is uniform across apps; the only
# variations are *derived*, never configured:
#   - build emits dist/server/wrangler.json (TanStack)  -> deploy --config that
#   - wrangler.toml has a D1 binding                     -> versioned: upload -> migrate -> promote
#     ...and that Worker does not exist yet              -> migrate -> one-shot deploy (creates it)
#   - otherwise                                          -> plain one-shot deploy
#
# Usage: app.sh <app-path> <target>, target = production | staging.
#
# The top-level wrangler block is DEV. Every target is an explicit
# `[env.<target>]` block with its own `name` and its own resources, and every
# wrangler call that reads this app's wrangler.toml passes `--env <target>`, so
# nothing here can ship the dev block, and a bare `wrangler deploy` from a
# laptop cannot reach production. D1 database name(s) are read from that same
# env via wrangler's own config reader (d1-databases.ts), never derived from the
# worker name, and every configured database is migrated.
#
# env/.env was already written from the schema by the deploy job (the only step
# that sees the Environment's secrets). This script runs check:env against it,
# builds with no Cloudflare credentials in the environment, and uploads it to
# the Worker as secrets on every path.
#
# DRY_RUN=1 prints the wrangler commands without running anything (still reads the config).
set -euo pipefail

app_path="${1:?usage: app.sh <app-path> <target>}"
target="${2:?usage: app.sh <app-path> <target>}"

# absolute path to this script's directory, captured before any `cd` so the helper resolves
script_dir="$(cd "$(dirname "$0")" && pwd)"

if [ "${DRY_RUN:-}" != "1" ]; then
  # Enforce env presence HERE, at deploy time, with the real values. A missing
  # required var fails the DEPLOY, not the PR build.
  #
  # CLOUDFLARE_ENV selects the wrangler environment at BUILD time: the Vite
  # plugin bakes the matching [env.<target>] (name, routes, bindings) into
  # dist/server/wrangler.json, and a wrangler dry-run build reads it too. The
  # build gets no Cloudflare credentials: it needs none, and a build plugin or
  # dependency has no business seeing them.
  (cd "$app_path" && pnpm check:env &&
    env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ENV="$target" pnpm run build)
fi

cd "$app_path"

env_flag=(--env "$target")

# Upload env/.env onto the Worker AS SECRETS on every path, so the runtime env
# is driven entirely by the GitHub Environment: no [vars] in wrangler.toml, no
# dashboard.
secrets_flag=()
[ -s env/.env ] && secrets_flag=(--secrets-file env/.env)

wr() {
  echo "+ wrangler $*"
  [ "${DRY_RUN:-}" = "1" ] || pnpm exec wrangler "$@"
}

# The name that ships, for the summary and the plain path. THIS IS A LABEL, NOT
# A SELECTOR on the versioned path: neither `versions upload` nor `versions
# deploy` takes a name, `--env` picks the block.
env_name() {
  awk -F'"' -v hdr="[env.${target}]" '
    $0 == hdr { inenv = 1; next }
    inenv && /^\[/ { exit }
    inenv && /^name = / { print $2; exit }
  ' wrangler.toml
}

summary_line() {
  [ -z "${GITHUB_STEP_SUMMARY:-}" ] ||
    echo "- \`${app_path}\` → **${1}** (${target}) version \`${2:-n/a}\`" >> "$GITHUB_STEP_SUMMARY"
  echo "deployed ${app_path} → ${1} (${target}) version ${2:-n/a}"
}

# Version id of what is live now, for the summary (and so a rollback target is
# easy to find). Best effort: a failed lookup never fails the deploy.
live_version() {
  [ "${DRY_RUN:-}" = "1" ] && return 0
  pnpm exec wrangler deployments status "$@" 2>/dev/null |
    sed -n 's/.*Version(s):[^0-9a-f]*\([0-9a-f-]\{36\}\).*/\1/p' | head -1 || true
}

if [ -f dist/server/wrangler.json ]; then
  # Generated-config app (e.g. a TanStack Start worker). The build already baked
  # [env.<target>] in, and the generated file has no environments to select, so
  # this one call takes no --env.
  worker="$(node -p 'require("./dist/server/wrangler.json").name')"
  wr deploy --config dist/server/wrangler.json "${secrets_flag[@]}"
  summary_line "$worker" "$(live_version --config dist/server/wrangler.json)"
  exit 0
fi

worker="$(env_name)"
[ -n "$worker" ] || {
  echo "::error::${app_path}: wrangler.toml has no [env.${target}] block with a name — add one (the top level is dev and never deploys)"
  exit 1
}

if grep -q 'd1_databases' wrangler.toml; then
  # Staging must never touch production data. Every env needs its own database.
  dup="$(awk -F'"' '/^database_id[[:space:]]*=/ {print $2}' wrangler.toml | sort | uniq -d)"
  [ -z "$dup" ] || {
    echo "::error::${app_path}: two envs share D1 database_id ${dup}, refusing to migrate from ${target}"
    exit 1
  }

  # Resolve the ACTUAL D1 database name(s) for this env from wrangler's own
  # config reader. Fails loud on a missing name or a placeholder id, and returns
  # every configured database so a two-database app migrates both.
  if ! db_list="$(TARGET_ENV="$target" pnpm exec tsx "$script_dir/d1-databases.ts")"; then
    echo "::error::${app_path}: could not resolve D1 database name(s) for env '${target}'"
    exit 1
  fi
  db_names=()
  while IFS= read -r db_name; do
    [ -n "$db_name" ] && db_names+=("$db_name")
  done <<<"$db_list"
  [ "${#db_names[@]}" -gt 0 ] || {
    echo "::error::${app_path}: wrangler.toml declares d1_databases but none resolved for env '${target}'"
    exit 1
  }

  migrate_all() {
    for db_name in "${db_names[@]}"; do
      wr d1 migrations apply "$db_name" --remote "${env_flag[@]}"
    done
  }

  # THE FIRST DEPLOY OF A WORKER IS THE ONE CASE THE VERSIONED PATH CANNOT SERVE.
  # `versions upload` only works against a script that already exists; against
  # a name it has never seen it fails with code 10007. So bring it into
  # existence here (migrations first: a brand-new Worker has no previous version
  # serving traffic) and fall through to the normal path. One redundant deploy,
  # once in a Worker's life.
  #
  # The probe matches 10007 specifically, not any non-zero exit: a network blip
  # is a different answer from "no such Worker", and reading one as the other
  # would ship unversioned.
  if [ "${DRY_RUN:-}" != "1" ]; then
    set +e
    probe="$(pnpm exec wrangler versions list "${env_flag[@]}" --json 2>&1)"
    set -e
    if printf '%s' "$probe" | grep -q 'code: 10007'; then
      echo "::notice::${app_path}: no Worker ${worker} on the account yet, creating it"
      migrate_all
      wr deploy "${env_flag[@]}" "${secrets_flag[@]}"
    fi
  fi

  # Set when the fallback below already shipped this deploy outright.
  promoted=""

  if [ "${DRY_RUN:-}" = "1" ]; then
    wr versions upload "${env_flag[@]}" "${secrets_flag[@]}"
    vid="<version-id>"
  else
    echo "+ wrangler versions upload ${env_flag[*]} ${secrets_flag[*]}"
    # Capture output without letting `set -e` abort before it is printed, so a
    # failed upload never leaves a blank log.
    set +e
    upload="$(pnpm exec wrangler versions upload "${env_flag[@]}" "${secrets_flag[@]}" 2>&1)"
    rc=$?
    set -e
    printf '%s\n' "$upload"

    # A VERSION CANNOT CARRY A DURABLE OBJECT MIGRATION. A new class, rename or
    # delete is script-level, written only by `wrangler deploy`. This fires once
    # in a class's life. Matched on BOTH "durable object" and "migration", so
    # an unrelated failure that mentions D1 migrations cannot take the
    # unversioned path.
    if [ "$rc" -ne 0 ] &&
      printf '%s' "$upload" | grep -qi 'durable object' &&
      printf '%s' "$upload" | grep -qi 'migration'; then
      echo "::notice::${app_path}: version upload cannot carry a Durable Object migration, deploying directly"
      migrate_all
      wr deploy "${env_flag[@]}" "${secrets_flag[@]}"
      promoted=1
      vid=""
    else
      [ "$rc" -eq 0 ] || {
        echo "::error::${app_path}: wrangler versions upload failed (exit ${rc})"
        exit 1
      }
      # Scraped from wrangler's "Worker Version ID:" line; if the wording ever
      # changes the parse yields empty and the guard fires.
      vid="$(printf '%s\n' "$upload" | grep 'Worker Version ID:' | sed 's/.*Worker Version ID: //' | tr -d '[:space:]')"
      [ -n "$vid" ] || {
        echo "::error::${app_path}: no Worker Version ID from upload"
        exit 1
      }
    fi
  fi
  # Migrate every database BEFORE promoting, so the schema is ready the moment
  # the new code goes live. Migrations are expand/contract, so the old version
  # still serving keeps working on the new schema.
  if [ -z "$promoted" ]; then
    migrate_all
    wr versions deploy "${vid}@100%" -y "${env_flag[@]}"
  fi
  # THE VERSIONED PATH DOES NOT APPLY TRIGGERS. Queue consumers, crons and
  # routes are script-level, written only by `wrangler deploy` and `wrangler
  # triggers deploy`. Without this a DB-backed app deploys GREEN while its queue
  # consumers are never attached and its crons keep their old schedule. Also
  # fails loud when a declared queue is missing.
  wr triggers deploy "${env_flag[@]}"
  summary_line "$worker" "${vid:-$(live_version "${env_flag[@]}")}"
else
  # Plain worker: one-shot deploy, which also creates the script, so no
  # first-deploy handling. `--env` is not optional even with `--name`: without
  # it wrangler reads the top-level (dev) block and ships those bindings under
  # this name, green.
  wr deploy --name "$worker" "${env_flag[@]}" "${secrets_flag[@]}"
  summary_line "$worker" "$(live_version --name "$worker" "${env_flag[@]}")"
fi
