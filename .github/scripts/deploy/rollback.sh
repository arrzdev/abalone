#!/usr/bin/env bash
# Roll back every worker of one deploy unit (rollback.yml). Reads TARGET, UNIT
# and optional VERSION_ID. Workers are rolled back in REVERSE manifest order
# (web before api), the mirror of the deploy order. D1 is never touched.
set -euo pipefail

target="${TARGET:?TARGET env required}"
unit="${UNIT:?UNIT env required}"
version="${VERSION_ID:-}"

account_id="${CLOUDFLARE_ACCOUNT_ID//[!a-fA-F0-9]/}"
[ "${#account_id}" -eq 32 ] || {
  echo "::error::CLOUDFLARE_ACCOUNT_ID must be 32 hex characters"
  exit 1
}
export CLOUDFLARE_ACCOUNT_ID="$account_id"

apps_json="$(grep -vE '^\s*//' .github/deploy-units.jsonc | jq -c --arg u "$unit" '[.[] | select(.name == $u) | .apps[]]')"
count="$(printf '%s' "$apps_json" | jq 'length')"
[ "$count" -gt 0 ] || {
  echo "::error::no unit named '${unit}' in .github/deploy-units.jsonc"
  exit 1
}
if [ -n "$version" ] && [ "$count" -gt 1 ]; then
  echo "::error::version_id names one worker's version; unit '${unit}' has ${count} apps. Leave it empty to roll each back to its previous version."
  exit 1
fi

while IFS= read -r app; do
  # The worker name for this env, the same one the deploy used.
  worker="$(awk -F'"' -v hdr="[env.${target}]" '
    $0 == hdr { inenv = 1; next }
    inenv && /^\[/ { exit }
    inenv && /^name = / { print $2; exit }
  ' "${app}/wrangler.toml")"
  [ -n "$worker" ] || {
    echo "::error::${app}: no [env.${target}] name in wrangler.toml"
    exit 1
  }
  echo "+ wrangler rollback ${version} --name ${worker}"
  (cd "$app" && pnpm exec wrangler rollback ${version:+"$version"} --name "$worker" \
    --message "rollback.yml run ${GITHUB_RUN_ID:-local}" -y)
  [ -z "${GITHUB_STEP_SUMMARY:-}" ] ||
    echo "- \`${app}\` → **${worker}** rolled back to \`${version:-previous}\`" >> "$GITHUB_STEP_SUMMARY"
done < <(printf '%s' "$apps_json" | jq -r 'reverse | .[]')
