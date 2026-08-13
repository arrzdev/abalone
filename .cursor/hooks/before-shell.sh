#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)
command=$(printf '%s' "$payload" | node -e "
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
try {
  const data = JSON.parse(input);
  process.stdout.write(String(data.command ?? ''));
} catch {
  process.stdout.write('');
}
")

if [[ -z "$command" ]]; then
  exit 0
fi

if printf '%s' "$command" | grep -qE '(^|[;&|[:space:]])rm[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*[[:space:]]+)+(/|~|\$HOME|\*)'; then
  printf '%s\n' '{"permission":"deny","userMessage":"Blocked: destructive rm in agent shell."}'
  exit 0
fi

if printf '%s' "$command" | grep -qE 'git[[:space:]]+push[[:space:]]+.*--force|git[[:space:]]+push[[:space:]]+-f'; then
  printf '%s\n' '{"permission":"deny","userMessage":"Blocked: force push requires human approval."}'
  exit 0
fi

if printf '%s' "$command" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard'; then
  printf '%s\n' '{"permission":"deny","userMessage":"Blocked: hard reset requires human approval."}'
  exit 0
fi

exit 0
