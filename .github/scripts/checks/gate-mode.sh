#!/usr/bin/env bash
# Prints the gate mode for a PR: docs | draft | full. Shared by every ci.yml
# job so the gate and the e2e shards always agree. Env: BASE, DRAFT.
set -euo pipefail

changed="$(git diff --name-only "$BASE"...HEAD)"
if [ -n "$changed" ] && ! printf '%s\n' "$changed" | grep -qvE '^(docs/|\.claude/)|\.md$'; then
  echo docs
elif [ "$DRAFT" = "true" ]; then
  echo draft
else
  echo full
fi
