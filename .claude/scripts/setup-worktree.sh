#!/usr/bin/env bash
# setup-worktree.sh — make a fresh git worktree ready for `pnpm dev`, and record
# the BASE branch it was forked from so the Claude Code app diffs against base
# (+0/-0 at creation) instead of falling back to a noisy diff.
#
# Steps (all idempotent):
#   1. copy gitignored env files (apps/*/env/.env) from the base branch's checkout
#   2. pnpm install
#   3. apply local D1 migrations for any backend that defines migrate:local
#   4. record the base branch for the app's diff and for `gh pr create --base`
#
# Usage:  .claude/scripts/setup-worktree.sh [base-branch]
#   base-branch  the branch the worktree was forked from. Auto-detected when
#                omitted; see .claude/scripts/lib/base-branch.sh for the order.
#                Pass it only to override the detection.
#
# Why this matters: a fresh worktree branch tracking origin/<own> shows [gone]
# until first push, so without a recorded base the app can fall back to a diff
# full of commits the branch never touched, and `gh pr create` can target the
# wrong branch. Recording the base (normally main on this repo) fixes both.
# Upstream is left untouched so `git push -u origin <branch>` behaves normally.
set -uo pipefail

WT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "✗ not a git repo"; exit 1; }
cd "$WT_ROOT"

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Base branch resolution is shared with pr-base.sh so the diff base and the PR
# target can never disagree. See .claude/scripts/lib/base-branch.sh.
# shellcheck source=lib/base-branch.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/base-branch.sh"

BASE=${1:-}
[ -z "$BASE" ] && BASE=$(resolve_base_branch "$BRANCH")
BASE=$(strip_ref "$BASE")

# Primary (non-worktree) checkout — canonical env source and fallback.
COMMON_DIR=$(git rev-parse --git-common-dir)
case "$COMMON_DIR" in /*) ;; *) COMMON_DIR="$WT_ROOT/$COMMON_DIR";; esac
MAIN_ROOT=$(cd "$(dirname "$COMMON_DIR")" && pwd)

# Path of the base branch's worktree, if it is checked out anywhere.
base_wt_path() {
  git worktree list --porcelain | awk -v b="refs/heads/$1" '
    /^worktree /{p=$2}
    /^branch /{ if ($2==b) { print p; exit } }'
}

echo "▸ worktree : $WT_ROOT"
echo "▸ branch   : $BRANCH"
echo "▸ base     : $BASE"

# ── 1. env files ────────────────────────────────────────────────────────────
# Enumerate from the source checkout's own ignore rules (no hardcoded paths):
# any gitignored .env / .env.* anywhere in the tree. This repo is `.env`-only by
# policy — no `.dev.vars` (backend validates and wrangler loads `env/.env`).
# --directory collapses fully-ignored dirs (node_modules, .wrangler) to one line.
list_env_files() {
  git -C "$1" ls-files --others --ignored --exclude-standard --directory 2>/dev/null \
    | grep -E '(^|/)\.env(\..*)?$' \
    | grep -vE '(^|/)(node_modules|dist|\.wrangler)/|^\.claude/worktrees/|\.env\.example$'
}

ENV_SRC=$(base_wt_path "$BASE")
if [ -z "$ENV_SRC" ] || [ "$ENV_SRC" = "$WT_ROOT" ] || ! list_env_files "$ENV_SRC" | grep -q .; then
  ENV_SRC="$MAIN_ROOT"
fi
copied=0
if [ "$ENV_SRC" != "$WT_ROOT" ]; then
  while IFS= read -r rel; do
    src="$ENV_SRC/$rel"
    [ -f "$src" ] || continue
    mkdir -p "$WT_ROOT/$(dirname "$rel")"
    cp "$src" "$WT_ROOT/$rel"
    echo "  + $rel"
    copied=$((copied + 1))
  done < <(list_env_files "$ENV_SRC")
fi
if [ "$copied" -gt 0 ]; then
  echo "✓ env      : copied $copied file(s) from $ENV_SRC"
else
  echo "⚠ env      : no gitignored env files found in $ENV_SRC — set them manually"
fi

# ── 2. dependencies ───────────────────────────────────────────────────────────
echo "▸ pnpm install …"
if pnpm install; then echo "✓ deps     : installed"; else echo "✗ deps     : pnpm install failed"; exit 1; fi

# ── 3. local D1 migrations (backend only) ─────────────────────────────────────
migrated=0
for pkgjson in apps/*/package.json; do
  [ -f "$pkgjson" ] || continue
  grep -q '"migrate:local"' "$pkgjson" || continue
  name=$(node -p "require('./$pkgjson').name" 2>/dev/null)
  [ -n "$name" ] || continue
  echo "▸ migrate:local → $name …"
  if pnpm --filter "$name" migrate:local; then
    echo "✓ migrate  : $name applied"
    migrated=$((migrated + 1))
  else
    echo "✗ migrate  : $name failed"; exit 1
  fi
done
[ "$migrated" -eq 0 ] && echo "· migrate  : no package defines migrate:local (skipped)"

# ── 4. record the base branch ─────────────────────────────────────────────────
# Two keys, because each survives something the other does not:
#   wtBase            our own record. nothing else writes it, so `git push -u`
#                     cannot destroy it. pr-base.sh reads this first.
#   vscode-merge-base what the Claude Code app and VS Code actually diff against.
#                     Without it the app falls back to a diff full of commits the
#                     branch never touched.
#
# Upstream is deliberately NOT touched. An earlier version pointed @{u} at the
# base to fix the app's diff, but that breaks `git push`: under git's default
# push.default=simple, a branch whose upstream has a different name is refused.
# The two keys above give the app its diff base without hijacking upstream, so
# `git push -u origin <branch>` behaves normally.
if git show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
  git config "branch.$BRANCH.wtBase" "origin/$BASE"
  git config "branch.$BRANCH.vscode-merge-base" "origin/$BASE"
  echo "✓ base     : $BRANCH → origin/$BASE (app diff + PR target)"
elif git show-ref --verify --quiet "refs/heads/$BASE"; then
  git config "branch.$BRANCH.wtBase" "$BASE"
  git config "branch.$BRANCH.vscode-merge-base" "$BASE"
  echo "✓ base     : $BRANCH → $BASE (local; origin/$BASE not found)"
else
  echo "⚠ base     : '$BASE' not found as origin/$BASE or local branch — left as-is"
fi

echo "▸ done. Run: pnpm dev"
