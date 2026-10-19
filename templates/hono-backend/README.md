# hono-backend template

A Cloudflare Worker API on Hono + Drizzle/D1, cut down from abalone's
`apps/backend`. Every file is copied from abalone and trimmed, not written
fresh: the middleware chain, error envelope, env registry, rate limiter,
health contract and test setup are the ones abalone runs in production.

What it ships:

- `entrypoint/worker.ts` — seeds the env registry, delegates to `api.fetch`
- `env/` — the Zod env schema, the typed registry, `check:env`, `.env.example`
- `src/http/` — `api.ts` (middleware order below), envelope, error codes,
  RPC `interface.ts`, network policy, middlewares (error catcher, rate limit,
  request log, `valid()`), plugins (build sha, cors)
- `src/http/routes/` — `health.routes.ts` and an example `notes` domain
- `src/services/` — `health.service.ts`, `notes.service.ts`
- `src/database/` — Drizzle client, schema, config, generated migration
- `shared/` — abalone's `packages/shared` kernel (`http`, `try-catch`,
  `logging`, `log-context`) and `packages/env-validation`, vendored
- `.claude/skills/` — the backend skills this code follows

Not included: auth. When a project needs it, copy abalone's
`src/http/middlewares/auth.ts` (+ `auth.service.ts`, `auth.schema.ts`) and
follow its `stack-auth` skill. `request-log.ts` already logs `user_id` from
`c.get("user")`, and `cors.ts` is already credentialed.

## Start a new project from it

Into a monorepo, as `apps/backend`:

```bash
cp -r templates/hono-backend <project>/apps/backend
# or, without a local abalone checkout (abalone is public, no auth needed):
pnpm dlx degit arrzdev/abalone/templates/hono-backend apps/backend
```

Then:

```bash
cd apps/backend
pnpm install            # --ignore-workspace if it should stay standalone
cp env/.env.example env/.env
pnpm check:env && pnpm dev
```

`biome.json` says `"root": false` because the template sits inside abalone,
nested under abalone's root config, and the same holds in any monorepo with a
root `biome.json`. Run alone (its own repo, no parent config), biome refuses
a non-root config: flip it to `"root": true`.

### Moving `shared/` into `packages/`

Imports already use the package names abalone uses (`@repo/shared/http`,
`@repo/env-validation/registry-factory`), resolved to `shared/` by
`tsconfig.json` `paths` and `vitest.config.ts` `resolve.alias`. In a
monorepo:

1. Move `shared/{http,try-catch,logging,log-context}.ts` to
   `packages/shared/` and `shared/env-validation/*.ts` to
   `packages/env-validation/src/`, with abalone's `package.json` for each
   (`exports` per file, `imports` `#shared/*` / `#env-validation/*`).
2. Add `"@repo/shared": "workspace:*"` and
   `"@repo/env-validation": "workspace:*"` to this package's dependencies.
3. Delete the `@repo/*` and `#*` entries from `tsconfig.json` `paths` and
   `vitest.config.ts` `alias`, and drop `shared/**/*` from `include`.

No source file changes.

## Rename checklist

- `wrangler.toml` worker `name` in all three blocks (`hono-backend-dev`,
  `hono-backend-staging`, `hono-backend`)
- D1 `database_name` per block, and `database_id` for staging and production
  (`wrangler d1 create <name>` prints it); the dev id stays the placeholder
- `migrate:local` in `package.json` names the dev database
- `routes` patterns and `zone_name`: `example.com` → the product domain
- `[[ratelimits]] namespace_id`: unique per limiter **in the Cloudflare
  account**, so pick numbers no other worker in the account uses (staging and
  production are given different ones on purpose)
- `package.json` `name` if `@repo/backend` is taken
- `FRONTEND_URLS` in `env/.env` and in each deploy environment's secrets
- the `notes` example: delete or replace it (routes, service, test, table)

## Routing map

| Hostname / path | Served by |
|---|---|
| `<domain>` | website worker (owns the custom domain) |
| `<domain>/api/*` | this worker, through a Worker route |
| `staging.<domain>` | website worker, staging |
| `staging.<domain>/api/*` | this worker, `[env.staging]` route |

- A Worker route beats a custom domain on the same hostname, so the API takes
  `/api/*` and the website keeps everything else. The browser calls the API
  same-origin.
- No `api.*` / `backend.*` subdomains, and no `custom_domain` on this worker.
- `workers_dev = false` in every block: no second public `*.workers.dev`
  hostname.
- A website worker that calls the API from its own server code uses a
  **service binding** to this worker. A same-zone `fetch()` skips Worker routes
  and would land on the website again.
- Bindings are not inherited by named envs, so every `[env.*]` block
  redeclares `DB`, `HEALTH_RATE_LIMITER` and `observability`.

## Middleware order (`src/http/api.ts`)

`requestLog` → `buildShaPlugin` → `corsPlugin` → `onError(errorCatcher)` →
`GET /` liveness → `/api/version` → `/api/v1` routes → `.all("*")`
`endpoint_not_found`.

## Health contract

`GET /api/v1/health` (the probe reachable from outside; `GET /` is local
liveness only, since production routes just `/api/*` here):

- asks each resource the cheapest question it answers, all at once, with a
  1.5 s timeout per check. Ships with `database` (`select 1` on D1);
  `health.service.ts` shows how to add `kv` (get of a missing key) and `r2`
  (head of a missing key). Queues are not probed (`send` is a side effect) and
  durable objects are not woken.
- all ok → `200 {"status":"success","data":{"database":"ok"}}`
- any down → `503 {"status":"error","error_code":"service_unavailable","data":{"database":"down"}}`
  — same data, so the probe sees which resource failed. A state only, never
  the error text.
- `Cache-Control: no-store` on both.
- `rateLimit("health")`: 60 per minute per address, counted by the
  `HEALTH_RATE_LIMITER` binding (declared in every wrangler block).

## Adding a domain

For a domain `widgets`:

1. table in `src/database/schema.ts`, then `pnpm db:generate` (read the
   `stack-database-migrations` skill first)
2. `src/services/widgets.service.ts` — `class WidgetsService { constructor(private db: Db) {} }`,
   `tryCatch` → `CustomError`
3. `src/http/routes/widgets.routes.ts` — `rateLimit("api")` first,
   `valid(target, schema)` in the route tuple, success path only, a
   `//---- name ----` banner per route
4. one line in `src/http/routes/index.ts`: `.route("/widgets", widgetsRoutes)`
5. `src/http/routes/widgets.routes.test.ts` (and
   `widgets.service.test.ts` when the service has logic of its own)

Orchestration across 2+ services goes in `src/facades/`, a service that needs
a second file becomes `src/modules/<domain>/` (see the READMEs there).

## Verify

```bash
pnpm typecheck
pnpm biome:check
pnpm test
pnpm build                          # wrangler deploy --dry-run --env production
CLOUDFLARE_ENV=staging pnpm build   # same, staging block
```
