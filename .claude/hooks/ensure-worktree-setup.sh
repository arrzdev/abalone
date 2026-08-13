#!/usr/bin/env bash
# SessionStart hook: make an unprepared worktree impossible to miss.
#
# The recurring failure was silent: open a session in a fresh worktree, and
# unless the agent *remembered* to bootstrap it, `pnpm dev`/env-check/the app's
# diff view were all broken. There is no reliable auto-trigger — the desktop
# app's WorktreeCreate hook fails EPERM under ~/Documents (TCC, no Full Disk
# Access), so it was left unwired.
#
# This runs on every SessionStart. It does NO file mutation and NO install
# (that would block session start and is more exposed to TCC). It only:
#   - detects whether we're in a linked worktree that isn't set up yet, and
#   - if so, injects a hard instruction telling the agent to run the bootstrap
#     script FIRST, before anything else.
# The agent runs the actual work via the Bash tool, which works fine here.
#
# Fail-soft: any error exits 0 and stays silent — a hook must never block a
# session. Detection is cheap (git rev-parse + a few stat()s).
set -uo pipefail

emit() {  # print SessionStart additionalContext JSON, then leave
  python3 - "$1" <<'PY' 2>/dev/null || printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "\"$1\""
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": sys.argv[1]}}))
PY
  exit 0
}

# Resolve the root we should inspect. Prefer the session's actual cwd (that's the
# worktree in a worktree session); fall back to CLAUDE_PROJECT_DIR. We do NOT
# trust CLAUDE_PROJECT_DIR blindly — if it points at the primary checkout we'd
# miss the worktree entirely. Accept a candidate only if it IS a linked worktree.
is_worktree() {  # $1 = dir → 0 if it's a linked worktree, non-zero otherwise
  case "$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null || echo)" in
    */worktrees/*) return 0 ;;
    *) return 1 ;;
  esac
}

ROOT=""
for cand in "$(git rev-parse --show-toplevel 2>/dev/null)" "${CLAUDE_PROJECT_DIR:-}"; do
  [ -n "$cand" ] || continue
  if is_worktree "$cand"; then ROOT="$cand"; break; fi
done
[ -n "$ROOT" ] || exit 0        # not in a worktree → nothing to do
cd "$ROOT" 2>/dev/null || exit 0

reasons=""
[ -d node_modules ] || reasons="node_modules missing"

# Any app that ships an env template but has no populated env file is unprepared.
for example in apps/*/env/.env.example; do
  [ -f "$example" ] || continue
  env_file="${example%.example}"
  if [ ! -f "$env_file" ]; then
    reasons="${reasons:+$reasons; }${env_file} missing"
  fi
done

[ -z "$reasons" ] && exit 0   # prepared — say nothing

emit "This is an UNPREPARED git worktree ($reasons). Before running dev servers, builds, or anything that reads env, run the bootstrap FIRST: \`.claude/scripts/setup-worktree.sh\` (no args — it auto-detects the base branch). It copies gitignored env files, installs deps, applies local D1 migrations, and sets the branch upstream to the base so the app diffs correctly. It is idempotent and safe to run now, unprompted."
