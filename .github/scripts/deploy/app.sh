#!/usr/bin/env bash
# Generic per-app deploy. The pipeline is uniform across apps; the only
# variations are *derived*, never configured:
#   - build emits dist/server/wrangler.json (TanStack)  -> deploy --config that
#   - wrangler.toml has a D1 binding                     -> versioned: upload -> migrate -> promote
#     ...and that Worker does not exist yet              -> migrate -> one-shot deploy (creates it)
#   - otherwise                                          -> plain one-shot deploy
# This project deploys ONE target: production off `main`. Apps whose config IS
# their wrangler.toml select it through an `[env.production]` block, because
# bindings differ between the values `wrangler dev` should use and the ones that
# ship. D1 database name(s) are read from that same env via wrangler's own config
# reader (see d1-databases.ts), never derived from the worker name, and every
# configured database is migrated. `stack-deploy-environments` keeps this shape.
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

# The name that ships. With an `[env.production]` block that block's `name` is it
# — a named env otherwise deploys as `<top-level-name>-production`, which is why
# the block sets it explicitly. Top level is the fallback, for the apps that have
# no environments at all.
#
# THIS IS A LABEL, NOT A TARGET. The versioned path passes no `--name` (neither
# `versions upload` nor `versions deploy` takes one); `$worker` only reaches the
# two non-versioned branches and the step summary. Do not "fix" it into a selector.
worker="$(awk -F'"' '
  /^\[env\.production\]/ { inenv = 1; next }
  inenv && /^\[/ { exit }
  inenv && /^name = / { print $2; exit }
' wrangler.toml)"
[ -n "$worker" ] ||
  worker="$(grep -m1 '^name = ' wrangler.toml | sed 's/.*"\(.*\)".*/\1/')"

# Every wrangler call that reads THIS app's wrangler.toml targets `[env.production]`.
# The generated-config branch below is the exception and takes no flag: TanStack
# emits dist/server/wrangler.json from the Vite build, and that file has no
# environments to select.
env_flag=(--env production)

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

  # THE FIRST DEPLOY OF A WORKER IS THE ONE CASE THIS PATH CANNOT SERVE. `versions
  # upload` only works against a script that already exists — the API has no
  # create-by-version path, and against a name it has never seen it fails with
  # "This Worker does not exist on your account" (code 10007). Everything below
  # assumes the script is there, which is true of every deploy except the first.
  #
  # So bring it into existence here and then fall through: `wrangler deploy` is
  # what creates a script, and the normal path below runs afterwards exactly as it
  # always does. Migrations go first because a brand-new Worker has no previous
  # version left serving traffic — schema before code is the only ordering with no
  # window in it. One redundant deploy, once in a Worker's life, and the versioned
  # path stays untouched.
  #
  # The probe matches 10007 specifically, not any non-zero exit: a network blip is
  # a different answer from "no such Worker", and reading one as the other would
  # ship unversioned. DRY_RUN skips it — the probe needs credentials and a local
  # rehearsal is not meant to.
  if [ "${DRY_RUN:-}" != "1" ]; then
    set +e
    probe="$(pnpm exec wrangler versions list "${env_flag[@]}" --json 2>&1)"
    set -e
    if printf '%s' "$probe" | grep -q 'code: 10007'; then
      echo "::notice::${app_path}: no Worker on the account yet — creating it"
      for db_name in "${db_names[@]}"; do
        wr d1 migrations apply "$db_name" --remote "${env_flag[@]}"
      done
      # No --name: `[env.production]` carries it, and `deploy` applies triggers
      # itself — the note further down about the versioned path not doing so is
      # exactly why this one needs nothing after it.
      wr deploy "${env_flag[@]}" $secrets_file
    fi
  fi

  if [ "${DRY_RUN:-}" = "1" ]; then
    wr versions upload "${env_flag[@]}" $secrets_file
    vid="<version-id>"
  else
    echo "+ wrangler versions upload ${env_flag[*]} $secrets_file"
    # Capture output, but do NOT let `set -e` abort the assignment on a non-zero
    # exit before we can print it — otherwise a failed upload leaves a blank log
    # (this is exactly how a missing binding once failed silently). Surface the
    # wrangler output, check the exit code explicitly, then parse the version id.
    set +e
    upload="$(pnpm exec wrangler versions upload "${env_flag[@]}" $secrets_file 2>&1)"
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
  # the moment the new code goes live. The env flag is not optional here: the name
  # is positional, but wrangler still looks it up in the config to find the id and
  # the migrations_dir, and the top-level block declares a different database.
  for db_name in "${db_names[@]}"; do
    wr d1 migrations apply "$db_name" --remote "${env_flag[@]}"
  done
  wr versions deploy "${vid}@100%" -y "${env_flag[@]}"
  # THE VERSIONED PATH DOES NOT APPLY TRIGGERS. `versions upload` + `versions deploy` push
  # only what lives inside a version: code, bindings, secrets. Queue consumers, cron
  # schedules and routes are script-level and are written solely by wrangler's internal
  # triggersDeploy(), reached from `wrangler deploy` and `wrangler triggers deploy` — never
  # from the versioned path. Omitting this makes a DB-backed app deploy GREEN while its
  # queue consumers are never attached (jobs enqueue and are consumed by nobody) and its
  # crons keep whatever schedule they last had.
  # The two non-versioned branches below call `wrangler deploy`, which already does this.
  # Also fails loud when a declared queue is missing — wrangler does not auto-create
  # queues the way it does R2 buckets.
  wr triggers deploy "${env_flag[@]}"
else
  # plain worker: one-shot deploy, which is also what creates the script, so this
  # branch needs no first-deploy handling of its own. No app takes it today; the
  # first one that does needs an `[env.production]` block.
  #
  # The env flag is not optional, even though `--name` already carries the name:
  # without it wrangler reads the TOP-LEVEL block, so the app would ship under the
  # production name with the dev bindings, and succeed while doing it. `--name`
  # together with `--env` was once left un-guessed here; it is exercised now
  # (`wrangler deploy --dry-run --name … --env production` resolves the production
  # bindings), so the pair is what this passes.
  wr deploy --name "$worker" "${env_flag[@]}"
fi

[ -z "${GITHUB_STEP_SUMMARY:-}" ] ||
  echo "- \`${app_path}\` → **${worker}**" >> "$GITHUB_STEP_SUMMARY"
echo "deployed ${app_path} → ${worker}"
