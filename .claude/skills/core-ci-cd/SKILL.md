---
name: core-ci-cd
description: Local verify gate and CI pipeline shape: lint, typecheck, build, test, and the rule that a deploy must gate itself. Use when touching CI, wondering which checks to run before finishing, or when checks fail outside your scope.
---

# CI/CD and verification

## Local verify (discover from repo)

Read root `package.json` scripts before assuming names. Typical monorepo scripts:

| Kind | Purpose |
|------|---------|
| lint | formatter + import-boundary lint (Biome) |
| typecheck | project references + per-member noEmit |
| build | turbo or workspace build |
| test | vitest via turbo filter |
| format fix / check | biome or equivalent |

**Definition of done:** tests for touched behavior; lint/typecheck/build for touched workspaces; brief summary of results to the human.

## CI pipeline (typical shape)

Read `.github/workflows/` (or equivalent) for exact jobs — do not assume paths.

- **Trigger:** PRs run one required job, `gate` (no CI on push: the deploy's verify is the post-merge gate). Pushes to deploy branches deploy.
- **Draft and docs-only PRs** run a lighter gate, decided **inside** the job. Never a workflow `paths` filter on a required check: a skipped required check stays pending and blocks the merge.
- **Verify (the deploy gate):** the **full** check set — lint, build, typecheck, test, schema check. Deploy jobs run only if it passes.
- **Deploy:** API/backend first (build → upload → migrate → promote); frontend after backend succeeds.
- **Target:** often Cloudflare Workers; secrets via CI env/vars.
- **Gate the deploy _inside the deploy workflow_.** A separate CI workflow runs independently and **can't** block a deploy — so the deploy's own verify must run the full gate, or a direct push (no PR) to a deploy branch can ship a failure. Keep the PR-CI and deploy-verify checks in sync (here both call `.github/actions/gate`).
- **Actions minutes are billed per job, rounded up to a minute.** Put small checks inside the one gate job, never in their own job.

## Pre-commit hook

May run formatter on staged files and re-stage. Does not always block on lint failures — still run full verify before finishing.

## Agent rules

- Do not deploy or push unless the human asked.
- When CI fails due to constraints outside your scope — stop, report evidence, offer choices; do not expand scope to green CI.
