---
name: worktree-setup
description: >-
  Make a fresh git worktree ready for `pnpm dev` and give it the right diff base — run .claude/scripts/setup-worktree.sh (base auto-detected from the branch's reflog; pass one only to override): copy gitignored env, pnpm install, migrate:local, set branch upstream to the BASE branch so the app diffs against base (not main). Load when in an unprepared worktree or setting one up.
---

# Worktree setup

Make a freshly-created git worktree ready to run `pnpm dev` with **no errors**, and give it the right diff base — every time, without the human asking. Do this **proactively** the moment you notice you're in an unprepared worktree (no `node_modules`, or missing `apps/*/env/.env`).

## The one command

```bash
.claude/scripts/setup-worktree.sh [base-branch]
```

`base-branch` is **optional**: the script auto-detects the branch this worktree was forked from via the branch's own reflog (`Created from …`, fixed at creation — survives the primary checkout moving), falling back to the configured merge target, then `main`. Pass it only to **override** the detection (e.g. the reflog record is gone after a history rewrite).

The script is idempotent. Run it again anytime; it only does what's missing.

## What it does (and why)

| Step | Action | Why |
|------|--------|-----|
| 1 | Copy every gitignored `.env` / `.env.*` file (enumerated from the source checkout's own ignore rules, no hardcoded paths — this repo is `.env`-only, no `.dev.vars`) from the base branch's checkout (falls back to the main checkout) | env files are **gitignored** — a fresh worktree has none, so `check:env` throws before `dev` starts. New env files anywhere are picked up automatically. |
| 2 | `pnpm install` | worktrees don't share `node_modules`. |
| 3 | `pnpm --filter <pkg> migrate:local` for any app defining it | local D1 state lives in each worktree's `.wrangler/`; a fresh one has an empty DB. |
| 4 | `git branch --set-upstream-to=origin/<base>` | so the Claude Code app diffs against **base**, showing `+0/-0` at creation. |

## The upstream / diff-base rule (important)

The app derives its "+xxx / −yyy" from the branch's git **upstream** (`@{u}`).

- A fresh worktree branch tracking `origin/<own-branch>` shows `[gone]` until first push → the app **falls back to diffing against `main`** → you see huge `+/−` before touching anything. This was the recurring pain.
- Fix: point `@{u}` at the **base branch** (`origin/<base>`). Then a PR based on `staging` diffs against `staging`, not `main`.
- `push.default=current` here, so `git push` still targets `origin/<own-branch>` regardless of upstream — **safe**. Bare `git pull` would reference base; don't run it bare in a worktree.

This **supersedes** the old policy (upstream → `origin/<own>`). `.claude/hooks/fix-worktree-upstream.sh` now only sets a safe `origin/main` default for main-based worktrees and never clobbers a base the script set; for any non-main base you must run the script. See the `worktree-branch-upstream` memory.

## Verify

```bash
git rev-list --left-right --count @{u}...HEAD   # → "0  0" on a fresh worktree
ls apps/*/env/.env                              # env present
```

Then the human can run `pnpm dev`. (Do **not** start dev servers yourself unless asked.)

## Notes

- The script must be run **from inside the worktree** (it uses `git rev-parse` to locate roots).
- If the base branch isn't checked out anywhere, env is copied from the main checkout — values are gitignored per-machine secrets and identical across branches, so this is correct.
- Pairs with the `worktree-*` memories. Related: `stack/gotchas`, `stack/database-migrations`.
