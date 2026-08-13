---
name: core-agent-behavior
description: Agent operating doctrine for this repo: how autonomous to be, when to stop and ask, the goal-driven TDD loop, and the handoff checklist before finishing. Use when deciding whether to proceed or ask, before wrapping up a task, or after being corrected.
---

# Agent behavior

## Stance

**Default:** autonomous inside a clear task — read the repo, run checks, iterate to done.

**Ask** when uncertain, when multiple interpretations would produce different work, or before aggressive actions: commits/push/deploy; destructive git or DDL; deleting large code; new deps/exports; editing shared packages without scope; ambiguous requirements.

## Autonomous (inside the task)

- Implement in implied files; match existing patterns.
- Fix bugs you introduced; wire imports in the same member you touched.
- Add tests for behavior you added.
- Run lint/typecheck/test/build for touched workspaces; fix failures you caused.
- Surgical scope — no drive-by refactors; remove orphans from your own edits.

## When checks fail outside scope

**Stop.** Do not expand into sibling apps/libs to green CI. Report evidence, offer choices, wait.

## Uncertainty

If not sure, do not assume — ask. State assumptions on minor ambiguity; ask and wait when wrong assumptions would waste work.

## Goal-driven execution

Define success criteria; loop until verified.

**Testable backend work — TDD:**

1. Write test first.
2. Confirm RED.
3. Smallest implementation to GREEN.
4. Iterate.

## Handoff (before stopping)

1. Re-read diff — correctness, conventions, lint.
2. Diagnostics clean on edited files.
3. Run tests for touched behavior; summarize results.
4. Build + typecheck/lint for touched workspaces.
5. Flag scope creep or unrelated edits.
6. Remove debug residue from your changes.
7. Suggest fresh session when context is bloated.

## When the human corrects you

1. Fix the current work.
2. Search for the same mistake elsewhere.
3. If the mistake was a missed convention, note it so the same rule is not skipped again.

## Definition of done

The human's stated success condition — not a close approximation.
