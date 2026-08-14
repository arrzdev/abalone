#!/usr/bin/env python3
"""PreToolUse(Edit|Write|MultiEdit) hook: inject the skills that govern the file
being edited, before it is edited.

The problem this solves: CLAUDE.md's routing table is *advisory*. It asks the
model to match a request to a row and read the listed skills first. That holds
early in a session and quietly stops holding once context is long — which is
exactly when conventions start drifting.

This makes the same routing MECHANICAL. It matches on the path about to be
written (not on trigger words in the prompt), so the rule fires whether or not
the model remembered the table.

Design constraints:
  - Announce each skill set once per session, but EXPIRE that after
    REANNOUNCE_AFTER. A long session gets compacted, which drops the skill
    content the agent read — without a TTL the hook would stay silent exactly
    when the agent has just lost the doctrine. Re-emitting every edit would
    burn context and train the model to ignore the block; never re-emitting
    is worse.
  - Never block. Any failure exits 0 and stays silent; a hook that breaks
    editing is worse than a hook that misses a reminder.
  - No repo state is mutated. Session memory lives in a temp dir.

Routing lives in .claude/skills/routing.json — edit that, not this file.
"""
# python 3.9 on stock macOS cannot evaluate `X | None` annotations at runtime
from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path

EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}

# re-announce a skill set this long after it was last shown. Sized to be longer
# than a burst of edits in one area, shorter than a session that gets compacted.
REANNOUNCE_AFTER = 45 * 60


def emit(context: str) -> None:
    """PreToolUse additionalContext. No permissionDecision — this never gates."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": context,
        }
    }))
    sys.exit(0)


def bail() -> None:
    sys.exit(0)


def repo_relative(path: str, root: Path) -> str | None:
    """Normalise to a repo-relative posix path.

    Worktrees matter here: the absolute path contains
    `.claude/worktrees/<branch>/apps/...`, so a naive match against
    `apps/**` fails and a naive match against `**/.claude/**` wrongly
    tags every file as skill-authoring. Resolve against the root the
    hook was actually invoked from.
    """
    try:
        candidate = Path(path).resolve()
    except (OSError, ValueError):
        return None
    try:
        return candidate.relative_to(root).as_posix()
    except ValueError:
        return None


def matches(rel: str, glob: str) -> bool:
    """Glob match with ** semantics, on a repo-relative posix path.

    fnmatch has no `**`, but its `*` DOES cross `/` — so `a/*/b/*` already
    behaves like `a/*/b/**`. That is the whole trick here. Do NOT "optimise"
    a trailing /** into a startswith() prefix test: it looks equivalent and
    silently breaks any glob with an earlier wildcard (`apps/*/env/**` never
    matched `apps/game/env/schema.ts`). Covered by test-hooks.py.
    """
    if glob.endswith("/**"):
        prefix = glob[:-3]
        return fnmatch.fnmatch(rel, prefix) or fnmatch.fnmatch(rel, prefix + "/*")
    if glob.startswith("**/"):
        tail = glob[3:]
        return fnmatch.fnmatch(rel, glob) or fnmatch.fnmatch(rel, tail) or rel.endswith("/" + tail)
    return fnmatch.fnmatch(rel, glob)


def main() -> None:
    raw = sys.stdin.read()
    if not raw.strip():
        bail()
    payload = json.loads(raw)

    if payload.get("tool_name") not in EDIT_TOOLS:
        bail()

    file_path = (payload.get("tool_input") or {}).get("file_path")
    if not file_path:
        bail()

    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path.cwd()).resolve()
    routing_file = root / ".claude" / "skills" / "routing.json"
    if not routing_file.is_file():
        bail()

    rel = repo_relative(file_path, root)
    if rel is None:
        bail()

    routing = json.loads(routing_file.read_text())

    skills: list[str] = []
    notes: list[str] = []

    baseline = routing.get("baseline") or {}
    if any(matches(rel, g) for g in baseline.get("globs", [])):
        skills.extend(baseline.get("skills", []))

    for rule in routing.get("rules", []):
        if any(matches(rel, g) for g in rule.get("globs", [])):
            skills.extend(rule.get("skills", []))
            if rule.get("note"):
                notes.append(rule["note"])

    # preserve first-seen order, drop duplicates
    ordered = list(dict.fromkeys(skills))
    if not ordered:
        bail()

    # announce a given skill set, then stay quiet until the TTL expires
    session = payload.get("session_id") or "nosession"
    key = hashlib.sha1(f"{session}:{','.join(ordered)}".encode()).hexdigest()[:16]
    state = Path(tempfile.gettempdir()) / f"claude-skill-routing-{session[:32]}"
    try:
        state.mkdir(parents=True, exist_ok=True)
        marker = state / key
        if marker.exists() and (time.time() - marker.stat().st_mtime) < REANNOUNCE_AFTER:
            bail()
        marker.touch()  # resets the TTL
    except OSError:
        pass  # can't dedupe — better to repeat than to fail

    listed = "\n".join(f"  {i}. .claude/skills/{s}/SKILL.md" for i, s in enumerate(ordered, 1))
    lines = [
        f"Skills governing `{rel}` — read any you have not already read in this "
        "session, in this order, before editing:",
        "",
        listed,
    ]
    if notes:
        lines += [""] + [f"Note: {n}" for n in notes]
    lines += [
        "",
        "These are the repo's conventions, not suggestions. Repeated at most "
        "every 45min per skill set (see .claude/hooks/route-skills.py).",
    ]
    emit("\n".join(lines))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # fail-soft, always: never block an edit because routing broke
        sys.exit(0)
