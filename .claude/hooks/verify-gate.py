#!/usr/bin/env python3
"""Stop hook: don't let a turn end with source edits that were never verified.

CLAUDE.md calls the verify gate mandatory (typecheck -> biome -> scoped build),
but nothing enforced it, and "declared done without running verify" is the
single most common way a session ships a broken tree. This closes that.

Behaviour:
  - Looks at the git worktree for modified/added TS/TSX under apps/ or
    packages/. Nothing dirty -> silent.
  - Blocks the stop ONCE per session with the exact commands, scoped to the
    workspaces actually touched (so the agent doesn't have to work out the
    turbo filter).
  - Never blocks twice. `stop_hook_active` is the runtime's own loop guard and
    is honoured first; a per-session marker backs it up. A verify gate that
    can trap a session is far worse than one that reminds once.

Not a substitute for running the checks — it cannot tell whether they passed,
only that source changed. It exists to make forgetting impossible, not to
grade the result.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

# workspace dir -> turbo filter, mirroring the scoped-build table in CLAUDE.md
FILTERS = {
    "apps/frontend": "@repo/frontend",
    "apps/backend": "@repo/backend",
    "packages/nativ": "@repo/nativ",
    "packages/shared": "@repo/shared",
    "packages/synq": "@repo/synq",
    "packages/dev": "@repo/dev",
    "packages/env-validation": "@repo/env-validation",
}
SOURCE_SUFFIXES = (".ts", ".tsx")


def dirty_workspaces(root: Path) -> set[str]:
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=root, capture_output=True, text=True,
    )
    if proc.returncode != 0:
        return set()

    touched: set[str] = set()
    for line in proc.stdout.splitlines():
        if len(line) < 4:
            continue
        path = line[3:].split(" -> ")[-1].strip().strip('"')
        if not path.endswith(SOURCE_SUFFIXES):
            continue
        # generated files are not authored source
        if path.endswith((".gen.ts", ".gen.tsx")):
            continue
        for workspace in FILTERS:
            if path.startswith(workspace + "/"):
                touched.add(workspace)
                break
    return touched


def main() -> int:
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}

    # the runtime's own loop guard — if we already blocked, let the turn end
    if payload.get("stop_hook_active"):
        return 0

    root = Path(subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True,
    ).stdout.strip())

    touched = dirty_workspaces(root)
    if not touched:
        return 0

    session = payload.get("session_id") or "nosession"
    marker = Path(tempfile.gettempdir()) / f"claude-verify-gate-{session[:32]}"
    if marker.exists():
        return 0
    try:
        marker.touch()
    except OSError:
        return 0  # can't dedupe -> stay silent rather than risk nagging

    if len(touched) == 1:
        build = f"pnpm exec turbo run build --filter={FILTERS[next(iter(touched))]}..."
    else:
        build = "pnpm build"

    print(
        "Source files changed in: " + ", ".join(sorted(touched)) + ".\n"
        "CLAUDE.md's verify gate is mandatory before this task is done. If you "
        "have not already run these this turn, run them now and fix what fails:\n\n"
        f"  pnpm typecheck\n  pnpm biome:check\n  {build}\n\n"
        "Then report all three results in one line. If you already ran them and "
        "they passed, say so and stop — this reminder fires once per session.",
        file=sys.stderr,
    )
    return 2  # block the stop; stderr is fed back to the model


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # fail-soft: never trap a session
