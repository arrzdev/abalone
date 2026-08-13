#!/usr/bin/env bash
# Deploy one unit: its changed apps, in order, fail-stop. `set -e` aborts the loop
# on the first failure, so the rest of the unit is skipped (atomicity = ordered
# fail-stop; see stack/deploy-environments). Reads UNIT, AFFECTED (JSON array of
# app paths, already ordered + changed-only) and TARGET from the environment.
set -euo pipefail

target="${TARGET:?TARGET env required}"
affected="${AFFECTED:?AFFECTED env required}"
here="$(cd "$(dirname "$0")" && pwd)"

apps=()
while IFS= read -r app; do
  [ -n "$app" ] && apps+=("$app")
done < <(printf '%s' "$affected" | jq -r '.[]')

echo "::group::deploy unit '${UNIT:-?}' → ${target} (${#apps[@]} app(s), ordered, fail-stop)"
for app in "${apps[@]}"; do
  echo "---- ${app} ----"
  bash "${here}/app.sh" "$app" "$target"
done
echo "::endgroup::"
