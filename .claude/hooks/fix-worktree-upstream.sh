#!/usr/bin/env bash
# On WorktreeCreate: give a fresh worktree branch a sensible diff base.
#
# POLICY (2026-07-06): a worktree's branch upstream should point at its BASE
# branch, so the Claude Code app diffs against base and shows +0/-0 at creation
# — NOT origin/<own-branch>, which is [gone] until first push and makes the app
# fall back to diffing against main (the old "+9999 -9999 before I did anything"
# bug). See the `worktree-setup` skill and `worktree-branch-upstream` memory.
#
# This hook only sets a SAFE DEFAULT (origin/main) for a just-created
# worktree/wip branch that has no upstream yet. It never clobbers an upstream
# that's already set — the authoritative bootstrap, .claude/scripts/setup-worktree.sh,
# sets upstream to the REAL base (staging, a feature branch, …) and must be run
# by the agent for any non-main base. Best-effort, idempotent, fail-soft.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

br=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$br" in
  worktree/*|wip/*) ;;
  *) exit 0 ;;                                   # never touch main/real branches
esac

# Leave any already-configured upstream alone (script may have set the real base).
git rev-parse --abbrev-ref "$br@{u}" >/dev/null 2>&1 && exit 0

git show-ref --verify --quiet refs/remotes/origin/main || exit 0
git branch --set-upstream-to=origin/main "$br" >/dev/null 2>&1 || exit 0

printf '{"systemMessage":"upstream %s -> origin/main (default). If this worktree is based on a non-main branch, run .claude/scripts/setup-worktree.sh <base>."}\n' "$br"
exit 0
