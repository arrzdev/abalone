#!/usr/bin/env python3
"""Validate the skills harness. Run after adding or renaming a skill.

    python3 .claude/scripts/check-skills.py

Checks, in order of how badly each one bites:

  1. Every `tier-name` cross-reference inside a skill resolves to a real file.
     A broken pointer sends an agent looking for doctrine that isn't there.
  2. Every skill is routed in CLAUDE.md. An unrouted skill is invisible —
     nothing will ever tell an agent to read it.
  3. Every skill named in routing.json exists, and its globs are plausible.
     The hook fails soft, so a typo here is silent forever.
  4. Frontmatter is valid, and no `core-` skill names this checkout's paths.
     (See core-skill-authoring — rule vs. lookup.)

Exit 1 on any failure so it can gate CI later if wanted.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILLS = ROOT / ".claude" / "skills"
CLAUDE_MD = ROOT / "CLAUDE.md"
ROUTING = SKILLS / "routing.json"

TIERS = ("core", "platform", "stack")
# a skill is a directory <tier>-<name>/ holding SKILL.md; the tier is the prefix
XREF = re.compile(r"`((?:" + "|".join(TIERS) + r")-[a-z0-9-]+)`")

# paths that only mean something inside THIS checkout — banned from core/
LOOKUP = re.compile(
    r"\bapps/(backend|frontend)/|@repo/(nativ|synq|shared|dev|backend|frontend|env-validation)\b"
    r"|\.claude/hooks/|biome\.json|\b(7171|8181|9220|9218)\b"
)
# Deliberate hybrids. commit-style's rule IS this repo's git workflow;
# skill-authoring documents the harness (hooks, routing.json) that ships
# alongside the skills, so naming those files is portable, not a checkout lookup.
LOOKUP_EXEMPT = {"core-commit-style", "core-skill-authoring"}

failures: list[str] = []
notes: list[str] = []


def skill_files() -> list[Path]:
    return sorted(
        d / "SKILL.md"
        for d in SKILLS.iterdir()
        if d.is_dir() and d.name.startswith(TIERS) and (d / "SKILL.md").is_file()
    )


def slug(p: Path) -> str:
    return p.parent.name


def tier(p: Path) -> str:
    return p.parent.name.split("-", 1)[0]


def check_frontmatter(files: list[Path]) -> None:
    """Native discovery needs name + description; a missing/mismatched name
    means the skill silently never loads."""
    for path in files:
        text = path.read_text()
        if not text.startswith("---\n"):
            failures.append(f"{slug(path)}: no YAML frontmatter (will not be discovered)")
            continue
        block = text.split("---", 2)[1]
        fields = dict(
            line.split(":", 1) for line in block.strip().splitlines() if ":" in line
        )
        name = fields.get("name", "").strip()
        desc = fields.get("description", "").strip()
        if name != slug(path):
            failures.append(f"{slug(path)}: frontmatter name is `{name}`, must match the directory")
        if len(desc) < 40:
            failures.append(f"{slug(path)}: description too thin to match on ({len(desc)} chars)")


def check_xrefs(files: list[Path]) -> None:
    known = {slug(p) for p in files}
    for path in files:
        for ref in XREF.findall(path.read_text()):
            if ref not in known:
                failures.append(f"{slug(path)}: dangling cross-reference `{ref}`")


def check_routed(files: list[Path]) -> None:
    if not CLAUDE_MD.is_file():
        failures.append("CLAUDE.md missing")
        return
    text = CLAUDE_MD.read_text()
    for path in files:
        if f"`{slug(path)}`" not in text:
            failures.append(f"{slug(path)}: not routed in CLAUDE.md (no agent will read it)")


def check_routing_json(files: list[Path]) -> None:
    if not ROUTING.is_file():
        failures.append("skills/routing.json missing — the hook will never fire")
        return
    data = json.loads(ROUTING.read_text())
    known = {slug(p) for p in files}

    referenced: set[str] = set()
    groups = [data.get("baseline") or {}] + list(data.get("rules") or [])
    for group in groups:
        for name in group.get("skills", []):
            referenced.add(name)
            if name not in known:
                failures.append(f"routing.json: references missing skill `{name}`")
        for glob in group.get("globs", []):
            probe = glob.split("*")[0].rstrip("/")
            if probe and not (ROOT / probe).exists():
                notes.append(f"routing.json: glob `{glob}` matches nothing on disk today")

    # prompt-triggered-only skills are legitimate; just report them
    unrouted = sorted(known - referenced)
    if unrouted:
        notes.append(
            "prompt-triggered only (no path rule — fine if they answer a question "
            "rather than govern a file): " + ", ".join(unrouted)
        )


def check_tier_hygiene(files: list[Path]) -> None:
    for path in files:
        if tier(path) != "core" or slug(path) in LOOKUP_EXEMPT:
            continue
        for n, line in enumerate(path.read_text().splitlines(), 1):
            if LOOKUP.search(line):
                failures.append(
                    f"{slug(path)}:{n}: a core- skill names this checkout "
                    f"({LOOKUP.search(line).group(0)}) — state the rule, put the path in a stack- skill"
                )


def main() -> int:
    files = skill_files()
    if not files:
        print("no skills found", file=sys.stderr)
        return 1

    check_frontmatter(files)
    check_xrefs(files)
    check_routed(files)
    check_routing_json(files)
    check_tier_hygiene(files)

    for note in notes:
        print(f"note: {note}")
    for failure in failures:
        print(f"FAIL: {failure}", file=sys.stderr)

    counts = {t: sum(1 for f in files if tier(f) == t) for t in TIERS}
    summary = ", ".join(f"{t}={n}" for t, n in counts.items())
    print(f"\n{len(files)} skills ({summary}) — {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
