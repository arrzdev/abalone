# Abalone monorepo

A pnpm + Turborepo monorepo with a React PWA frontend and a Hono backend, both
running on Cloudflare Workers, wired to deploy from GitHub Actions. It ships as
a working boilerplate: sign-in, an offline-first synced collection, a D1
database with migrations, per-environment secrets, and a deploy pipeline that
grows by one line per new app.

## Layout

| | |
| --- | --- |
| `apps/frontend` | React 19 + Vite + TanStack Start, served by a Worker. PWA shell, service worker, offline-first data |
| `apps/backend` | Hono on a Worker. D1 + Drizzle, better-auth, the generic sync endpoints |
| `packages/nativ` | the PWA shell framework: app config, generated router, native-feeling components, hooks, service worker |
| `packages/synq` | the offline-first sync engine: local store, outbox, HLC merge, the server half |
| `packages/shared` | the kernel both apps import — `tryCatch`, logging, the Hono endpoint factory |
| `packages/env-validation` | schema-checked env with one registry per app |
| `packages/dev` | the dev runner: port clearing, LAN log sink, local cron setup |
| `.github/` | CI, the deploy pipeline, and `deploy-units.jsonc` — what deploys and in what order |
| `.claude/`, `.cursor/` | agent skills, routing hooks, and the verify gate |

Apps consume packages through workspace exports (`@repo/nativ`, `@repo/synq`, …)
and never reach past a package's public entry points.

## Requirements

- Node 22+ (`.nvmrc`)
- pnpm 9.15.4 (`corepack enable`)
- A Cloudflare account, for deploying

## Setup

```bash
pnpm install
```

Then give each app its env — the `.env.example` files are the documented
contract, and `check:env` fails the dev server and the deploy if a required
value is missing:

```bash
cp apps/backend/env/.env.example apps/backend/env/.env
cp apps/frontend/env/.env.example apps/frontend/env/.env
```

Fill in `BETTER_AUTH_SECRET` (`openssl rand -hex 32`). The rest of the defaults
already point at the local ports.

Create the local database and apply migrations:

```bash
pnpm migrate:local
```

## Day to day

```bash
pnpm dev
```

Frontend on `http://localhost:7171`, backend on `http://localhost:8181`. Both
bind `0.0.0.0`, so another device on the same network can reach them — point
`VITE_BACKEND_URL` and `BETTER_AUTH_URL` at your machine's LAN IP to test the
PWA on a phone.

| | |
| --- | --- |
| `pnpm build` | build every app |
| `pnpm typecheck` | project references + the two standalone projects |
| `pnpm biome:check` / `pnpm biome:fix` | lint and format |
| `pnpm test` | Vitest across the workspace (backend runs on a real local D1) |
| `pnpm test:e2e` | Playwright smoke test against a running frontend |
| `pnpm logs` | the LAN log sink — device consoles forwarded to your terminal |
| `pnpm tail` | live Worker logs from the deployed backend |

Anything that edits source is done when typecheck, Biome, and the build all
pass; that gate is also what CI runs.

## Adding a collection

`apps/frontend/src/data/collections/items/` is a complete worked example of the
offline-first path: a row shape plus its transport, a reactive read hook, plain
async mutations, and a Zod schema for the UI type. Copy the folder, rename the
collection, and register it in `src/data/store.ts`. The backend needs no change
— `POST /api/v1/sync/:collection/{pull,push}` is collection-agnostic and scopes
every row to the signed-in user.

`preferences` is the other half of the example: a local-only singleton that
never syncs.

## Deploying

The pipeline is driven by `.github/deploy-units.jsonc`. An app deploys only if
it is listed there and has a `wrangler.toml`; apps inside one unit deploy in
order and stop on the first failure, and units run in parallel. Only apps
changed in the push actually deploy.

Adding a third app is a `wrangler.toml` plus one line in that manifest — no
workflow edits.

**Branches:** `main` → production, `staging` → staging, `deployment-test` →
force-redeploys everything.

**First-time setup:**

1. Create the D1 databases and paste their ids into `apps/backend/wrangler.toml`
   (both `database_id` fields start as `REPLACE_WITH_…` placeholders):

   ```bash
   pnpm exec wrangler d1 create abalone-backend-db
   pnpm exec wrangler d1 create abalone-backend-staging-db
   ```

2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the repo's
   `production` and `staging` GitHub environments.

3. Add each app's env vars as secrets or variables in those environments. The
   deploy writes `env/.env` from `env/schema.ts` — the schema is the allowlist,
   so only declared keys are ever written — then uploads it onto the Worker as
   secrets. Nothing is configured in the Cloudflare dashboard.

A database-backed Worker deploys as upload → migrate → promote, so the schema is
in place before the new code goes live. Destructive DDL is blocked on PRs unless
it carries an explicit acknowledgment.

Rehearse the whole thing without touching Cloudflare:

```bash
DRY_RUN=1 bash .github/scripts/deploy/app.sh apps/backend production
```

## Renaming it

The project name appears in `package.json`, both `wrangler.toml` files (worker
and D1 names), `apps/frontend/nativ.config.ts`, the bearer-token key in
`src/data/auth/token.ts`, and `SYNQ_DB_NAME` in `src/data/store.ts`. The icons
under `apps/frontend/public/favicons/` are placeholders — replace them along
with the name.

## Licence

MIT — see [LICENSE](LICENSE).
