#!/usr/bin/env python3
"""End-to-end tests for the agent hooks.

    python3 .claude/scripts/test-hooks.py

Runs the real hooks as subprocesses with real payloads — nothing here
reimplements their logic, so a bug in a hook fails the test rather than being
mirrored by it.

Covers route-skills.py (which skills get injected for a path) and
verify-gate.py (blocks a stop exactly once when source is unverified).

Why this exists: routing.json is edited by hand and the hook fails SOFT by
design. A typo'd glob or a renamed skill produces silence, not an error, and
silence looks exactly like "this file has no skills". These cases lock in the
routing that matters, so a future edit can't quietly stop covering the backend
or the sync engine.

Each case asserts the FULL expected list including order — order is the thing
the CLAUDE.md table exists to preserve, so it is worth pinning.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOOK = ROOT / ".claude" / "hooks" / "route-skills.py"
GATE = ROOT / ".claude" / "hooks" / "verify-gate.py"

BASE = ["core-code-style", "core-repository-layout", "core-imports"]

# path -> exactly the skills the hook must inject, in order
CASES: list[tuple[str, list[str]]] = [
    ("apps/backend/src/services/items.service.ts",
     BASE + ["core-backend-architecture", "core-try-catch", "core-custom-errors", "stack-database"]),
    ("apps/backend/src/http/routes/items.routes.ts",
     BASE + ["stack-api-routes", "core-backend-architecture", "core-custom-errors", "core-copywriting"]),
    # a sync route is BOTH an http route and sync — both rules must contribute
    ("apps/backend/src/http/routes/sync.routes.ts",
     BASE + ["stack-api-routes", "core-backend-architecture", "core-custom-errors", "core-copywriting",
             "stack-sync-engine", "stack-frontend-data"]),
    # auth.service.ts is a service AND auth — both rules contribute, auth last
    ("apps/backend/src/services/auth.service.ts",
     BASE + ["core-backend-architecture", "core-try-catch", "core-custom-errors", "stack-database",
             "stack-auth"]),
    ("apps/backend/src/http/middlewares/auth.ts",
     BASE + ["stack-auth", "stack-api-routes", "core-backend-architecture",
             "core-custom-errors", "core-copywriting"]),
    ("apps/frontend/src/data/auth/token.ts",
     BASE + ["stack-auth", "stack-frontend-data", "core-try-catch"]),
    ("apps/backend/src/database/schema.ts",
     BASE + ["stack-database-migrations", "stack-database", "core-try-catch"]),
    ("apps/frontend/src/data/collections/items/mutations.ts",
     BASE + ["stack-sync-engine", "stack-frontend-data", "core-try-catch"]),
    ("apps/frontend/src/data/backend-client.ts",
     BASE + ["stack-frontend-data", "core-try-catch"]),
    # components/ui is both a component and shell — shell rules append
    ("apps/frontend/src/components/ui/drawer.tsx",
     BASE + ["core-react-components", "core-motion", "core-input-handling",
             "stack-ui-shell", "platform-ios-webkit", "stack-gotchas"]),
    ("apps/frontend/src/components/items/item-card.tsx",
     BASE + ["core-react-components", "core-motion", "core-input-handling"]),
    ("packages/synq/src/core/merge.ts",
     BASE + ["stack-sync-engine", "stack-frontend-data"]),
    ("packages/nativ/src/components/screen.tsx",
     BASE + ["stack-ui-shell", "core-react-components", "platform-ios-webkit", "stack-gotchas"]),
    ("apps/frontend/env/schema.ts",
     BASE + ["stack-env-config", "stack-deploy-environments"]),
    ("apps/backend/src/services/items.service.test.ts",
     BASE + ["core-backend-architecture", "core-try-catch", "core-custom-errors", "stack-database",
             "core-testing", "stack-testing-setup"]),
    ("e2e/smoke.spec.ts", ["core-testing", "stack-testing-setup"]),
    (".github/workflows/deploy.yml", ["core-ci-cd", "stack-deploy-environments"]),
]

# these must produce NO output — noise here trains the model to ignore the hook
SILENT = ["README.md", "pnpm-lock.yaml", "biome.json", ".gitignore"]


def run(payload: dict) -> str:
    env = {**os.environ, "CLAUDE_PROJECT_DIR": str(ROOT)}
    proc = subprocess.run(
        [sys.executable, str(HOOK)], input=json.dumps(payload),
        capture_output=True, text=True, env=env,
    )
    if proc.returncode != 0:
        raise AssertionError(f"hook exited {proc.returncode} (must always be 0): {proc.stderr}")
    if not proc.stdout.strip():
        return ""
    return json.loads(proc.stdout)["hookSpecificOutput"]["additionalContext"]


def skills_for(rel: str) -> list[str]:
    """Fresh session id per call so the TTL/dedupe never masks a result."""
    out = run({
        "tool_name": "Edit",
        "session_id": f"test-{uuid.uuid4().hex}",
        "tool_input": {"file_path": str(ROOT / rel)},
    })
    return [
        line.split("skills/")[1].split("/SKILL.md")[0]
        for line in out.splitlines() if "/SKILL.md" in line
    ]


def gate(payload: dict) -> int:
    """Run the Stop hook; 2 means it blocked, 0 means it let the turn end."""
    proc = subprocess.run(
        [sys.executable, str(GATE)], input=json.dumps(payload),
        capture_output=True, text=True, cwd=ROOT,
    )
    return proc.returncode


def check_verify_gate() -> int:
    """The gate must block once on unverified source, then never trap a session."""
    bad = 0
    session = f"gate-{uuid.uuid4().hex}"

    # stop_hook_active is the runtime's loop guard — it must win unconditionally
    if gate({"session_id": session, "stop_hook_active": True}) != 0:
        bad += 1
        print("FAIL verify-gate ignored stop_hook_active (can trap a session)")

    scratch = ROOT / "apps" / "backend" / "src" / "utils" / "is-private-origin.ts"
    original = scratch.read_text()
    try:
        scratch.write_text(original + "\n//verify-gate test\n")
        if gate({"session_id": session}) != 2:
            bad += 1
            print("FAIL verify-gate did not block on unverified source changes")
        if gate({"session_id": session}) != 0:
            bad += 1
            print("FAIL verify-gate blocked twice in one session")
    finally:
        scratch.write_text(original)
    return bad


def main() -> int:
    failed = 0

    for rel, expected in CASES:
        got = skills_for(rel)
        if got != expected:
            failed += 1
            print(f"FAIL {rel}")
            print(f"     expected: {expected}")
            print(f"     got:      {got}")
            missing, extra = set(expected) - set(got), set(got) - set(expected)
            if missing:
                print(f"     missing:  {sorted(missing)}")
            if extra:
                print(f"     extra:    {sorted(extra)}")

    for rel in SILENT:
        got = skills_for(rel)
        if got:
            failed += 1
            print(f"FAIL {rel} should be silent, got {got}")

    # the dedupe/TTL must actually suppress a repeat within one session
    session = f"test-{uuid.uuid4().hex}"
    probe = {"tool_name": "Edit", "session_id": session,
             "tool_input": {"file_path": str(ROOT / CASES[0][0])}}
    if not run(probe):
        failed += 1
        print("FAIL first announcement in a session was empty")
    if run(probe):
        failed += 1
        print("FAIL repeat within a session was not suppressed")

    # a non-edit tool must never trigger
    if run({"tool_name": "Bash", "session_id": session, "tool_input": {"command": "ls"}}):
        failed += 1
        print("FAIL Bash triggered the routing hook")

    failed += check_verify_gate()

    total = len(CASES) + len(SILENT) + 3 + 3
    print(f"\n{total - failed}/{total} hook assertions passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
