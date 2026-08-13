#!/usr/bin/env python3
"""PreToolUse(Bash) guard: enforce PR-title style on `gh pr create` / `gh pr edit`.

Repo rule (see .claude/skills/core/commit-style.md "Pull request titles"):
  PR titles use Conventional Commits — `type(scope): summary`, imperative mood,
  lowercase, no trailing period. The PR title becomes the squash-merge subject,
  so it must already be a valid commit subject (GitHub appends the `(#N)`).

This catches the common slips: a non-conventional title (no `type:` prefix), an
unknown/uppercased type, a Capitalized or past-tense summary. It blocks the call
(exit 2) with a corrected title so the model retries in the right format.

Scope: only `gh pr create` / `gh pr edit` titles. Idempotent, side-effect free.
"""
import json
import re
import shlex
import sys

ALLOWED_TYPES = (
    "feat", "fix", "refactor", "perf", "docs", "test",
    "chore", "style", "build", "ci", "revert",
)

# `type(scope)!: summary` — scope and the breaking-change `!` are optional.
TITLE_RE = re.compile(
    r"^(?P<type>[a-zA-Z]+)(?P<scope>\([^)]+\))?(?P<bang>!)?: (?P<summary>.+)$"
)

# past tense -> imperative, to nudge summaries back to imperative mood. Only a
# clear past-tense first word blocks, so legitimate imperative summaries never
# false-positive. (Inverse of the verb list the old past-tense rule used.)
PAST_TO_IMPERATIVE = {
    "fixed": "fix", "added": "add", "updated": "update", "removed": "remove",
    "refactored": "refactor", "improved": "improve", "reworked": "rework",
    "smoothed": "smooth", "bumped": "bump", "documented": "document",
    "reduced": "reduce", "capped": "cap", "moved": "move", "made": "make",
    "changed": "change", "tweaked": "tweak", "adjusted": "adjust",
    "prevented": "prevent", "disabled": "disable", "enabled": "enable",
    "handled": "handle", "dropped": "drop", "cleaned": "clean", "wired": "wire",
    "hooked": "hook", "guarded": "guard", "polished": "polish",
    "restored": "restore", "renamed": "rename", "merged": "merge",
    "allowed": "allow", "simplified": "simplify", "replaced": "replace",
    "extracted": "extract", "consolidated": "consolidate", "hardened": "harden",
    "gated": "gate", "scoped": "scope", "wrapped": "wrap", "deferred": "defer",
    "debounced": "debounce", "throttled": "throttle", "memoized": "memoize",
    "normalized": "normalize", "centralized": "centralize", "unified": "unify",
    "migrated": "migrate", "ported": "port", "exposed": "expose",
    "surfaced": "surface", "silenced": "silence", "suppressed": "suppress",
    "corrected": "correct", "aligned": "align", "created": "create",
    "deleted": "delete", "implemented": "implement", "built": "build",
    "wrote": "write", "sent": "send", "supported": "support",
    "ensured": "ensure", "avoided": "avoid", "resolved": "resolve",
    "addressed": "address", "introduced": "introduce", "optimized": "optimize",
    "clarified": "clarify", "formatted": "format", "linted": "lint",
    "validated": "validate", "sanitized": "sanitize", "parsed": "parse",
    "rendered": "render", "redirected": "redirect", "cached": "cache",
    "invalidated": "invalidate", "synced": "sync", "persisted": "persist",
    "serialized": "serialize", "deduplicated": "deduplicate", "deduped": "dedupe",
    "switched": "switch", "adopted": "adopt", "centered": "center",
    "froze": "freeze", "reimplemented": "reimplement", "repainted": "repaint",
    "kept": "keep", "reset": "reset", "split": "split", "shipped": "ship",
}

TEMPLATE = "type(scope): summary  e.g. 'feat(viewer): export replay clips'"


def extract_title(cmd: str):
    try:
        tokens = shlex.split(cmd)
    except ValueError:
        return None
    for i, tok in enumerate(tokens):
        if tok in ("--title", "-t") and i + 1 < len(tokens):
            return tokens[i + 1]
        if tok.startswith("--title="):
            return tok[len("--title="):]
    return None


def block(reason: str):
    print(
        "PR title violates repo style (.claude/skills/core/commit-style.md):\n"
        + reason
        + "\nRe-run with the corrected --title.",
        file=sys.stderr,
    )
    sys.exit(2)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    cmd = data.get("tool_input", {}).get("command", "")
    if not re.search(r"\bgh\s+pr\s+(create|edit)\b", cmd):
        sys.exit(0)

    title = extract_title(cmd)
    if not title:
        sys.exit(0)

    m = TITLE_RE.match(title)
    if not m:
        block(
            "  PR titles must be Conventional Commits.\n"
            f"  got:      {title!r}\n"
            f"  expected: {TEMPLATE}"
        )

    ctype = m.group("type")
    if ctype != ctype.lower() or ctype.lower() not in ALLOWED_TYPES:
        block(
            f"  unknown/invalid type {ctype!r}.\n"
            f"  allowed:  {', '.join(ALLOWED_TYPES)}"
        )

    summary = m.group("summary")
    first = summary.split()[0] if summary.split() else ""

    # past-tense first word -> nudge to imperative
    imperative = PAST_TO_IMPERATIVE.get(first.lower())
    if imperative:
        fixed = imperative + summary[len(first):]
        prefix = title[: title.index(summary)]
        block(
            "  summary must be imperative mood, not past tense.\n"
            f"  got:      {title!r}\n"
            f"  expected: {prefix + fixed!r}"
        )

    # Capitalized summary -> nudge to lowercase first letter
    if first and first[0].isupper():
        fixed = summary[0].lower() + summary[1:]
        prefix = title[: title.index(summary)]
        block(
            "  summary must start lowercase.\n"
            f"  got:      {title!r}\n"
            f"  expected: {prefix + fixed!r}"
        )

    if summary.rstrip().endswith("."):
        block(
            "  summary must not end with a period.\n"
            f"  got:      {title!r}"
        )

    sys.exit(0)


if __name__ == "__main__":
    main()
