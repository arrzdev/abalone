---
name: commit-style
description: >-
  Conventional Commits (type(scope): summary), split commits by story,
  subject/PR-title grammar, formatting before staging. Load when the user asks
  to commit, stage work, or prepare a commit or PR title.
---

# Commit style

## Grouping commits (detective mindset)

Read `git status`, `git diff`, and untracked files. Reconstruct what actually happened — cluster paths so each commit tells **one true story**. Start from a **split-commit assumption**.

**Story-first test:** a commit is valid only if its subject explains every staged file without sounding vague. If you need "and also" or mixed reasons — that's multiple commits.

**Single-commit gate:** only when all changed files pass the same-story test and one concise "why" covers everything. If in doubt, split.

**Dirty / oversized worktree:** when unstaged changes are large or span several concerns, do **not** dump them into one commit. Group by story, stage each group with explicit pathspecs (`git add <paths>`), and commit in a sensible order (refactor/chore before the feat that builds on it). Different `type`s in the diff are a strong split signal — a `fix` and a `feat` in the same change are two commits.

## Conventional Commits (format)

This repo uses **Conventional Commits**: `type(scope): summary`.

```
feat(viewer): export replay clips as shareable video
fix(pwa): debounce the update toast reload button
refactor(tasks): extract card checkbox into a hook
```

| Type | Use for |
|------|---------|
| `feat` | new user-facing capability |
| `fix` | bug fix |
| `refactor` | code change, no behavior change |
| `perf` | performance improvement |
| `docs` | documentation only |
| `test` | adding/fixing tests |
| `chore` | tooling, deps, config — no src behavior |
| `style` | formatting/lint only |
| `build` / `ci` | build system or pipeline |

## Match repo history (mandatory)

Run **`git log`** before writing messages — but for **scope vocabulary and area names**, not format. The repo adopted Conventional Commits as of this change; older subjects use a lowercase past-tense style (`centered single-line task card`). **Do not copy that older format** — follow this doc. Reuse the scope names you see (`viewer`, `tasks`, `keyboard`, `drawer`) so scopes stay consistent.

## Formatting before commit (mandatory)

From the **repository root**, run the repo formatter/linter (e.g. biome check/fix from root `package.json`) first. Re-run `git status` and `git diff` after — formatting may have modified additional files; fold those into the same story-based commits.

## Commit mechanics

- Subject: single `git commit -m "…"`. Body with bullets: **one** `-m` string containing **real newline characters** between bullets.
- Do not write commit messages to a `.txt` file.
- Request git-write permission before `git commit`.
- No signatures, footers, or tool credits in messages.

### Literal `\n` in messages (avoid)

**Symptom:** `git log` shows `\` and `n` as characters instead of a line break.

**Fix:** use bash ANSI-C quoting: `git commit -m $'subject\n\n- first bullet\n- second bullet'` or open the editor with `git commit` (no `-m`).

## Environment files and secrets

Never commit `.env`, `.env.*`, `.envrc`, `*.pem`, `*.key`, or credential files. Unstage silently found secrets (`git restore --staged <path>`), warn the user listing which paths were skipped.

## Subject line (hard rules)

Format: **`type(scope): summary`**

- **type** — one of the table above. Lowercase.
- **scope** — the feature/area touched (`viewer`, `tasks`, `drawer`, `keyboard`). Lowercase. Include it whenever an area fits; omit only when the change is genuinely repo-wide (`chore: bump deps`).
- **summary** — **imperative mood**: completes _"this commit will ___"_ (`add`, `fix`, `extract`, `remove`). Lowercase first word, no period, no emoji.
- Whole subject ≤ **50** chars (aim 40–48). One idea — not a file list.
- Breaking change: `feat(scope)!: …` or a `BREAKING CHANGE:` footer in the body.

## Pull request titles

PR titles use the **same Conventional Commits format** as the subject — `type(scope): summary`, imperative, lowercase, ≤50 chars, no period. Because the repo squash-merges, the PR title becomes the commit subject, so it must already be a valid subject line.

| Surface | Example |
|---------|---------|
| Commit subject | `feat(viewer): export replay clips as shareable video` |
| PR title | `feat(viewer): export replay clips as shareable video` |
| Squash subject | `feat(viewer): export replay clips as shareable video (#55)` |

## Merging a PR — method is SQUASH, always (mandatory)

**This repo's history is squash-only.** Every merged PR is exactly one commit: `type(scope): summary (#N)`. Never introduce `Merge pull request #N from …` commits or replayed per-branch commits — they make the history inconsistent and are painful to unwind.

**The rule:** merge a PR with squash and nothing else.

```
gh pr merge <N> --squash --delete-branch
```

- **Never** `--merge` (creates a `Merge pull request #N` commit + preserves every branch commit with no `(#N)`).
- **Never** `--rebase` (replays per-branch commits, also no `(#N)`).
- If merging via the GitHub UI, use the **"Squash and merge"** button, not "Create a merge commit" or "Rebase and merge".
- `--delete-branch` fails harmlessly when the head branch is checked out in a worktree — the merge still succeeds; ignore that warning (or omit the flag).

Do **not** rely on repo defaults or memory for this — the repo currently has all three merge methods enabled on GitHub, so `--merge`/`--rebase` are possible and will silently break the convention. The safeguard is this rule.

> Why this doc exists: PRs were once merged with `--merge`, producing `Merge pull request #N` commits that broke the squash history and had to be repaired with a force-push rewrite. Do not repeat it.

## Squash subject (mandatory)

The commit that lands on the target branch (squash-merge) **must be a valid Conventional Commits subject** with history's `(#N)` suffix:

`feat(viewer): export replay clips as shareable video (#55)`

GitHub builds the squash subject from the PR title. Since PR titles now use this same format, **accept the default** — just confirm GitHub appended `(#N)`. Do not capitalize the type and do not add a period.

## Body — avoid

- **Do not** add a body by default — subject-only commits are the norm.
- **No bullet lists** unless truly necessary.
- Body only when the subject cannot carry required context **and** splitting into another commit is wrong — rare.
- When in doubt: **split commits** instead of writing a long body.
