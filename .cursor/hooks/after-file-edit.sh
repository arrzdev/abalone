#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)
file_path=$(printf '%s' "$payload" | node -e "
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
try {
  const data = JSON.parse(input);
  const path = data.file_path ?? data.path ?? '';
  process.stdout.write(String(path));
} catch {
  process.stdout.write('');
}
")

if [[ -z "$file_path" ]]; then
  exit 0
fi

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.mjs|*.cjs)
  ;;
  *)
    exit 0
    ;;
esac

repo_root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$repo_root"

pnpm exec biome check --write --unsafe "$file_path" >/dev/null 2>&1 || true
exit 0
