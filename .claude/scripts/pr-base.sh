#!/usr/bin/env bash
# pr-base.sh — print the branch this one was forked from, for use as the PR base.
#
#   gh pr create --base "$(.claude/scripts/pr-base.sh)" …
#
# This repo integrates on main, which is also the GitHub default branch, so the
# harness's "Main branch (you will usually use this for PRs): main" hint is
# correct here. The value of resolving explicitly is that a worktree branch
# records its own fork point in git config, so the app diffs against the right
# base and this script targets it reliably — rather than leaving either to
# inference. Two things make inference wrong: `git worktree add` records the fork
# point as a bare SHA in the reflog ("Created from <sha>"), which naive
# prefix-stripping turns into a 40-char string matching no ref; and `git push -u`
# rewrites upstream, so upstream cannot be relied on to carry the base.
#
# Resolution is shared with setup-worktree.sh so the app's diff base and the PR
# target always agree. Pass --verbose to see which rule matched.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

# shellcheck source=lib/base-branch.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/base-branch.sh"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=$(resolve_base_branch "$BRANCH")

if [ "${1:-}" = "--verbose" ]; then
  echo "branch : $BRANCH" >&2
  echo "base   : $BASE" >&2
  if git show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
    echo "diff   : $(git diff --shortstat "origin/$BASE...HEAD" 2>/dev/null)" >&2
  fi
fi

# A branch cannot be its own base; failing loudly beats opening a broken PR.
if [ "$BASE" = "$BRANCH" ]; then
  echo "✗ resolved base equals the current branch ($BRANCH)" >&2
  exit 1
fi

printf '%s\n' "$BASE"
