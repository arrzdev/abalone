#!/usr/bin/env bash
# base-branch.sh — resolve which branch a worktree/feature branch was forked from.
#
# Sourced by setup-worktree.sh (to configure the diff base) and pr-base.sh (to
# pick the PR target). Both must agree, so the logic lives here once.
#
# Exposes: resolve_base_branch [branch] → prints a bare branch name (no refs/ or
# origin/ prefix), always succeeds (falls back to DEFAULT_BASE).

# This repo integrates directly on main, which is also the GitHub default
# branch — there is no staging split. The base for a feature/worktree branch is
# normally main.
DEFAULT_BASE=${DEFAULT_BASE:-main}

# Ranked candidates when mapping a commit back to a branch. Order matters: a
# fresh worktree's fork point is usually also the tip of one of these.
PREFERRED_BASES=${PREFERRED_BASES:-"main"}

# Reduce any ref spelling to a bare branch name. Handles refs/heads/x,
# refs/remotes/origin/x and a bare origin/x. Only strips a leading segment that
# is an actual configured remote, so branch names that legitimately contain a
# slash (worktree/foo) survive intact.
strip_ref() {
  local ref=$1 remote
  ref=${ref#refs/heads/}
  ref=$(printf '%s\n' "$ref" | sed -E 's#^refs/remotes/[^/]+/##')
  for remote in $(git remote 2>/dev/null); do
    case "$ref" in
      "$remote"/*) ref=${ref#"$remote"/}; break ;;
    esac
  done
  printf '%s\n' "$ref"
}

is_sha() {
  printf '%s\n' "$1" | grep -qE '^[0-9a-f]{7,40}$'
}

branch_exists() {
  git show-ref --verify --quiet "refs/remotes/origin/$1" ||
    git show-ref --verify --quiet "refs/heads/$1"
}

# Map a bare commit to the branch it most likely came from. `git worktree add`
# records "Created from <sha>" in the reflog rather than a branch name, which is
# why this is needed at all.
resolve_sha_to_branch() {
  local sha=$1 candidate resolved

  resolved=$(git rev-parse --verify --quiet "$sha^{commit}") || return 1

  # exact tip match on a preferred branch — the common case for a fresh worktree
  for candidate in $PREFERRED_BASES; do
    git show-ref --verify --quiet "refs/remotes/origin/$candidate" || continue
    if [ "$(git rev-parse "refs/remotes/origin/$candidate")" = "$resolved" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  # any remote branch whose tip is exactly this commit
  candidate=$(git for-each-ref --format='%(refname:short)' \
    --points-at "$resolved" 'refs/remotes/origin/*' 2>/dev/null | head -1)
  if [ -n "$candidate" ]; then
    strip_ref "$candidate"
    return 0
  fi

  # otherwise the preferred branch that already contains the commit, closest first
  for candidate in $PREFERRED_BASES; do
    git show-ref --verify --quiet "refs/remotes/origin/$candidate" || continue
    if git merge-base --is-ancestor "$resolved" "refs/remotes/origin/$candidate" 2>/dev/null; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

# Resolution order, most authoritative first. Each step is skipped if it yields
# nothing usable, so a partially-configured branch still resolves.
resolve_base_branch() {
  local branch=${1:-$(git rev-parse --abbrev-ref HEAD)}
  local base created merge

  # 1. recorded at worktree setup. survives `git push -u`, which rewrites
  #    upstream and would otherwise destroy the only record of the base.
  base=$(git config "branch.$branch.wtBase" 2>/dev/null || true)
  [ -n "$base" ] && { strip_ref "$base"; return 0; }

  # 2. whatever the editor is diffing against
  base=$(git config "branch.$branch.vscode-merge-base" 2>/dev/null || true)
  if [ -n "$base" ]; then
    base=$(strip_ref "$base")
    [ "$base" != "$branch" ] && branch_exists "$base" && { printf '%s\n' "$base"; return 0; }
  fi

  # 3. the branch's own creation record, fixed at creation and immune to the
  #    primary checkout moving later. usually a bare SHA, hence the mapping.
  created=$(git reflog show "$branch" 2>/dev/null | grep -oE 'Created from .*$' | tail -1 || true)
  if [ -n "$created" ]; then
    base=$(strip_ref "${created#Created from }")
    if is_sha "$base"; then
      base=$(resolve_sha_to_branch "$base" || true)
    fi
    if [ -n "$base" ] && [ "$base" != "$branch" ] && branch_exists "$base"; then
      printf '%s\n' "$base"
      return 0
    fi
  fi

  # 4. configured merge target, when it points at a different branch
  merge=$(git config "branch.$branch.merge" 2>/dev/null || true)
  if [ -n "$merge" ]; then
    base=$(strip_ref "$merge")
    if [ "$base" != "$branch" ] && branch_exists "$base"; then
      printf '%s\n' "$base"
      return 0
    fi
  fi

  printf '%s\n' "$DEFAULT_BASE"
}
