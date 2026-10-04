---
name: deploy-environments
description: >-
  Manifest-driven Cloudflare deploys (main → production only, no staging): .github/deploy-units.jsonc declares which apps deploy + their coupling/order, one generic matrixed deploy job, [env.production] + D1 migrations, the full deploy gate, and the human-only D1 + GitHub-Environment setup. Load for adding a new app, deploy units, wrangler environments, different bindings for dev and production.
---

# Deploy environments (apps, units, production only)

Cloudflare Workers deploy from `main` to production (there is no staging) via a **manifest-driven** pipeline — adding an app is a line in `.github/deploy-units.jsonc`, never a workflow edit. Wired in `.github/workflows/deploy.yml`, `.github/deploy-units.jsonc`, and `.github/scripts/{deploy/discover.mjs,deploy/unit.sh,deploy/app.sh}`.

## Adding an app — the whole surface

`.github/deploy-units.jsonc` (the deploy **manifest**) is the source of truth: an app deploys **only if it's listed there**, and it must have a `wrangler.toml`.

| App | What you do |
|-----|-------------|
| **Standalone** | add a single-app unit: `{ "name": "marketing", "apps": ["apps/marketing"] }` |
| **Coupled** (api + web, deploy together/ordered) | list them in **one** unit, in deploy order |
| **DB-backed** | also add `[[d1_databases]]` (+ `[[env.production.d1_databases]]`) to its `wrangler.toml` — the migrate dance is automatic |

A `wrangler.toml` **not** in the manifest won't deploy — `discover` emits a CI warning so it isn't forgotten. A Swift app / lib has no wrangler.toml and is never a candidate.

## Deploy units (the manifest)

`.github/deploy-units.jsonc` declares what deploys and how it's grouped:

```jsonc
[ { "name": "public", "apps": ["apps/backend", "apps/frontend"] } ] // ordered, fail-stop
// a standalone app is just a unit with one app
```

- Within a unit: deploy left→right, **fail-stop** (one fails → the rest skip). True atomic isn't achievable on Workers+D1 — fail-stop + backward-compatible changes is the model (see `stack/database-migrations`).
- Units run in parallel. Only **changed** apps deploy (turbo `--affected` in `discover`), so an unchanged app in a changed unit is skipped.

## How it runs (deploy.yml)

`guard` (debounce) → `discover` (emit the unit matrix) → `verify` (full gate) → `deploy` (one generic job, `strategy.matrix` over units). The `deploy` job loops a unit's changed apps in order via `deploy/unit.sh` → `deploy/app.sh`. **No per-app job, no cross-job `needs`.**

## `deploy/app.sh` — uniform; everything else is derived

```
write-env (app's schema ← GH env) → build →
  config: dist/server/wrangler.json exists (TanStack)?  → deploy --config that
  has D1: wrangler.toml [[d1_databases]]?
     yes → versioned: upload → migrate this env's DB → deploy @100% → triggers deploy   (+ prod-DB guard)
     no  → plain: deploy
  always --name <worker>
```

### A version does not carry triggers

`versions upload` + `versions deploy` push only what lives **inside** a version: code, bindings, secrets. **Queue consumers, cron schedules and routes are script-level**, written solely by wrangler's internal `triggersDeploy()` — reached from `wrangler deploy` and `wrangler triggers deploy`, **never** from the versioned path. So the versioned branch (and only that branch — the other two call `wrangler deploy`, which already does it) must end with `wrangler triggers deploy`.

Omit it and a DB-backed app deploys **green** while:

- queue **producers** work (a binding, so it ships in the version) but **consumers are never attached** — jobs enqueue and are consumed by nobody, with no error anywhere;
- **crons keep whatever schedule they last had**, so a renamed cron silently stops running while an orphaned one keeps firing.

Nothing in the pipeline catches it, because a pre-deploy `verify` gate cannot see post-deploy state.

Two config keys are load-bearing for this step, because `triggers deploy` **writes** them every run:

- **`workers_dev`** — with the key absent, wrangler defaults it to **enabled** for a worker with no routes, publishing the app on a `*.workers.dev` hostname beside any custom domain. Pin it explicitly (`workers_dev = false`) for a custom-domain app; leave it unset for one that is meant to be served on `*.workers.dev`.
- **`[triggers] crons`** — an **inherited** key, so a named env silently gets the top-level crons unless it declares its own. Set `crons = []` for an env that should have none; the empty list is applied, not ignored.

Routes are safe: with none declared, wrangler skips route publishing entirely and never deletes out-of-band custom domains.

**Naming** (derived, not configured): the worker is `[env.production] name`; the D1 database is whatever `database_name` says, read through wrangler's config parser.

## One target: production

The `discover` job maps `main` to `production` and fails on any other ref. `environment: production` selects the **GitHub Environment** (its secrets/vars). Cloudflare named environments **do not inherit bindings** or `name`, so `[env.production]` repeats the full binding set; the top-level block is dev only. `deploy/app.sh` passes `--env production` to every wrangler call, and aborts *before upload* if a `database_id` is still a `REPLACE_WITH_…` placeholder or is shared by two envs.

## Every deploy is fully gated

`verify` runs the **full** check set — write-env (vars) → lint → build → typecheck → migration-safety → `db:check` → test — and `deploy` runs **only on `verify` success**. So a **direct push to `main`** (no PR) can't ship a failure. `ci.yml` (the PR gate) and `deploy.yml` are independent workflows — a separate CI run can't block a deploy, so the deploy workflow gates itself. Keep the two check sets in sync.

## Human-only setup (the agent cannot do these)

Per new DB-backed app / environment:

1. **Create the D1:** `wrangler d1 create <db-name>`, paste its `database_id` into `[[env.production.d1_databases]]` (replaces the `REPLACE_WITH_…` placeholder).
2. **Populate the `production` GitHub Environment** with the app's vars. Platform does this; ask on the issue.
3. **Create every queue**, per env: `wrangler queues create <name>`. Wrangler **does not auto-create queues** the way it does R2 buckets — it only fails on a missing one. That check lives in `triggers deploy`, so before that step existed a missing queue was invisible.
4. **First deploy is unverified** — confirm on the first push that the version lands on the expected worker and migrations hit the expected database. Rehearse with `DRY_RUN=1 bash .github/scripts/deploy/app.sh apps/<x> production`.

After a first deploy, confirm the **triggers** landed, not just the code — `wrangler queues info <queue>` should show a consumer, and the worker's schedules should match `[triggers] crons`. A green deploy does not imply either.

## Agent rules

- **Never deploy or push** to `main` unless the human asks — a push deploys to production.
- The D1-create + queue-create + GitHub-Environment steps are **human-only**; scaffold the config and hand over the checklist.
- See `core/ci-cd` for pipeline shape and `stack/database-migrations` for the migration/backward-compat model + its CI guard.
