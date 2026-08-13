---
name: stack-database-migrations
description: The mandatory gate before any schema change, the expand-and-contract model, what is safe to migrate while old code serves traffic, and the CI safety guard. Use before generating a migration, editing schema.ts, or proposing any DDL.
---

# Database migrations (deploy pipeline)

## Mandatory gate — ask before any schema work

**Stop. Do not generate migrations, edit `schema.ts`, or propose DDL until the human chooses a strategy.**

The deploy pipeline applies migrations to the **live production database in Phase 3**, *before* the new Worker version receives traffic (Phase 4). You can insulate code rollout; you cannot insulate a shared database.

**Ask explicitly:**

> This migration will run against production before the new code goes live.
> How should we handle it?
>
> 1. **Backward-compatible (expand)** — safe while old code still serves traffic; may require multiple deploys for renames/drops.
> 2. **Destructive (contract / break)** — drop/rename/retype in one step; acceptable only when no live users depend on old code (e.g. pre-alpha, pre-release, empty DB).

**Do not assume backward-compatible.** Pre-alpha / pre-release often *should* be destructive — the human decides, not the agent.

**Proceed only after the human answers.** If they already stated a choice in the thread, confirm once and continue.

## The principle: no atomic deploy

No transaction spans "apply DDL" + "shift Worker traffic" — you **cannot** make migrate+deploy atomic, on D1 or anywhere. So instead you make every **intermediate state valid**: old code must work against the new schema, and new code against the old. That is *parallel change* (expand/contract). The destructive step isn't banned — it's **deferred to the contract phase**, once no deployed code references the old shape, so the schema doesn't stay messy forever. A change that genuinely needs one instant flip belongs behind a **feature flag**, not an "atomic" migration.

## Why Phase 3 is critical

| Phase | What changes | Live users see |
|-------|----------------|----------------|
| 2 — Upload | Inactive Worker version | Old code |
| **3 — Migrate** | **Production D1 schema** | **Old code + new schema** |
| 4 — Promote | Traffic to new Worker | New code + new schema |

Old code must tolerate the post-migration schema until Phase 4 completes (and longer if promotion is delayed).

## Safe vs unsafe in Phase 3 (backward-compatible path)

Use this table **only when the human chose backward-compatible**.

| Operation | Safe in Phase 3? | Why |
| --- | --- | --- |
| Add a new table | **Safe** | Running app does not reference it yet. |
| Add a nullable or default column | **Safe** | Old queries ignore it; inserts still work. |
| Add a non-null column without default | **Unsafe** | Old inserts fail unless every path supplies the column. |
| Delete a column | **Critical failure** | Old `SELECT` / `INSERT` break immediately. |
| Rename a column | **Critical failure** | Old code still uses the old name. |
| Change column type | **Usually unsafe** | Old code and drivers may reject values. |
| Drop a table | **Critical failure** | If old code touches it. |

## Expand & contract (when human chose backward-compatible)

Destructive intent (rename, drop, retype) requires **multiple deploys**. Never combine expand and contract in one migration when old code is live.

### Deploy 1 — Expand

1. **Migration:** Add the new shape alongside the old (e.g. add `new_name` next to `old_name`).
2. **Code:** Write to both; read from the old column/table.

### Deploy 2 — Contract

1. **Migration:** Backfill legacy data into the new shape.
2. **Code:** Read and write only the new shape.

### Deploy 3 — Cleanup (optional)

1. **Migration:** Drop the old column/table — safe only after no deployed code references it.

### Temporary backward-compat code (mark and retire)

When you add or leave a backward-compat path, put a **dated marker comment** on the block:

```ts
// BACKWARD_COMPAT 2026-06-03: dual-write `old_name` until deploy 3 drops column (expand deploy 1)
```

Rules:

- Token: `BACKWARD_COMPAT` (grep-friendly). Date: ISO `YYYY-MM-DD`.
- One marker per compat island; say what it bridges and which deploy step it belongs to.
- Keep the implementation runnable; the comment is for humans and future agents, not a substitute for deletion.

**Future agents** — when you find `BACKWARD_COMPAT` in backend code:

1. Read the marker date; use `git log` / `git blame` on that line to see when it landed and how long ago.
2. **Stop and ask the human** (do not remove unilaterally).
3. **Remove only after an explicit yes:** delete the compat path, any matching cleanup migration, and the marker comment in the same change set.

## Destructive path (when human chose destructive)

Allowed when the human explicitly accepts breakage risk (pre-alpha, pre-release, no production traffic, coordinated downtime).

- Single migration may drop, rename, or retype in one step.
- Update `schema.ts`, queries, and services in the **same** change set.
- **Mark the migration** with a header line so the CI guard passes (it blocks an unacknowledged destructive migration): `-- safety: destructive: <why it's safe now>`. For the cleanup-drop of an expand/contract cycle use `-- safety: contract: <what it drops; which expand landed>`.
- Still run the repo's schema-check and local migrate scripts before push.
- Warn once: Phase 3 will apply this to remote production on merge to the deploy branch.

## Pipeline commands (discover from repo)

Read the API app's `package.json` scripts, `wrangler.toml` (or equivalent), and the CI workflow — do not assume script names.

| Phase | Typical action |
|-------|----------------|
| Verify (CI) | Schema drift check (`drizzle-kit check` or repo equivalent) |
| Local before PR | Generate SQL from schema; apply to local D1 |
| Remote migrate (CI) | Apply migrations to production DB — **agents must not run without human acceptance** |

## Multiple databases (D1)

Each D1 is a **separate SQLite database** — **no cross-database JOINs and no transaction spans two.** Add a second D1 only for isolation / scale / lifecycle (e.g. a high-write analytics or audit-log store kept off the app DB); tables you query together stay in **one** database. If a JOIN would answer the question, it's one database.

Wiring is the single-DB stack repeated once per database:

| Layer | Per database |
| --- | --- |
| **Drizzle** | Its own config with its own `out` migrations dir — drizzle tracks migration state per folder. `db:generate` runs once per config. |
| **`wrangler.toml`** | One `[[d1_databases]]` block: distinct `binding`, `database_name`, `database_id`, `migrations_dir`. Repeat under every `[env.<name>]` — named envs don't inherit bindings. |
| **Deploy** | `app.sh` reads **every** configured `database_name` from the wrangler config (`.github/scripts/deploy/d1-databases.ts`) and applies each one's `migrations_dir` before promoting the new version. Adding a database needs **no** deploy-script edit — the name is read, never derived from the worker. |
| **Runtime** | The Worker exposes one binding each (`env.DB`, `env.ANALYTICS_DB`, …). Build one drizzle client per binding, each with its own schema. |

The Phase-3 safety gate applies to **each database independently** — a destructive change is judged against that database's live code, and its migration carries its own `-- safety:` header.

## If Phase 3 fails

- Phase 4 does not run — users stay on old code.
- D1 rolls back a failed migration file when possible; fix the script and redeploy.
- With backward-compatible migrations, a failed deploy rarely takes the site offline.

## CI guard (mechanical)

Two checks back the discipline up (`.github/scripts/`):

- **`checks/migration-safety.mjs`** (blocking) — a newly-added migration with destructive SQL (`DROP` / `RENAME` / retype, or `ADD … NOT NULL` with no `DEFAULT`) **fails the build** unless it carries an in-file acknowledgment header:
  ```sql
  -- safety: destructive: counter unused since v2, no prod rows
  -- safety: contract: drops old_name; expand landed in 0007, code migrated
  ```
  This makes the mandatory gate mechanical — destructive DDL can't ship without a recorded, reviewed decision. It runs on **PRs** (`ci.yml`) **and** in the **deploy gate** (`deploy.yml` `verify`), so a direct push to a deploy branch is covered too.
- **`checks/compat-markers.mjs`** (non-blocking) — lists every `BACKWARD_COMPAT <date>` shim with its age and warns on stale ones (>30d), so the contract/cleanup deploy isn't forgotten.

**Before opening a PR with schema work, run both** (and act on what they say):

```
node .github/scripts/checks/migration-safety.mjs
node .github/scripts/checks/compat-markers.mjs
```

When the reminder flags a stale marker, **stop and ask the human** about the contract/cleanup deploy — never drop a compat shim unilaterally (same rule as the `BACKWARD_COMPAT` section above).

## Agent permissions

| Action | Allowed |
| --- | --- |
| Local generate / check / migrate scripts | Yes, after human chose strategy |
| Edit schema + migration SQL | Yes, after human chose strategy |
| Remote migration apply | **No** — CI only unless human explicitly asks |
