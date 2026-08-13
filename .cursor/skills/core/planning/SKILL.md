---
name: planning
description: >-
  Multi-phase planning for large features: discover, explore, clarify, design, build, review.
  Load for plan mode, architecture decisions, multi-file ambiguous work. Skip one-liners.
---

# Planning

**When:** multi-file feature, unclear requirements, real architecture choice.  
**Skip:** single edits, obvious fixes, urgent hotfixes.

**Bias:** consolidate existing code over parallel helpers. Get explicit go-ahead before implementing.

## Phase 1 — Discovery

What problem? What should it do? Constraints? Summarize and confirm.

## Phase 2 — Explore

Find similar features; trace data flow. Read 5–10 key files. Summarize patterns and entry points.

## Phase 3 — Clarify

Numbered questions on edge cases, data contract, scope, migrations. **Stop** until answered unless human says "you decide" — then state pick once and confirm.

## Phase 4 — Design

2–3 approaches (minimal / clean / pragmatic). Pros/cons. Recommend one. **Ask which before coding.**

## Phase 5 — Build

Ship agreed design only. Match patterns in the repo you explored in Phase 2.

## Phase 6 — Review

Bugs, missing handling, duplication, convention violations. Ask: fix now, later, or proceed.

## Phase 7 — Summarize

What was built, key decisions, files touched, verify steps.
