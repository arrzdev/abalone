# Abalone monorepo

The Abalone game, plus the boilerplate it is built on: a pnpm + Turborepo
monorepo of Cloudflare Workers, wired to deploy from GitHub Actions. The
boilerplate half is deliberately thin — a Hono API with a health check and one
worked example endpoint, a D1 database with migrations, per-environment secrets,
and a deploy pipeline that grows by one line per new app.

## Layout

| | |
| --- | --- |
| `apps/game` | the Abalone game — React 19 on the `@repo/nativ` PWA shell, TanStack Start routing, served by a Worker |
| `apps/backend` | Hono on a Worker. D1 + Drizzle, the layered http/services structure, health + an example route |
| `packages/nativ` | the PWA shell framework: app config, generated router, native-feeling components, hooks, service worker |
| `packages/shared` | the kernel the apps import — `tryCatch`, logging, the Hono endpoint factory |
| `packages/env-validation` | schema-checked env with one registry per app |
| `packages/dev` | the dev runner: port clearing, LAN log sink, local cron setup |
| `.github/` | CI, the deploy pipeline, and `deploy-units.jsonc` — what deploys and in what order |
| `.claude/`, `.cursor/` | agent skills, routing hooks, and the verify gate |

Apps consume packages through workspace exports (`@repo/nativ`, `@repo/shared`,
…) and never reach past a package's public entry points. Every package here has
a consumer; nothing is kept on spec.

The game talks to nothing of ours: it holds no server state and signs nobody in,
so it never calls the backend. The two are in one repo for the toolchain and the
pipeline, not for a shared runtime.

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
for app in apps/*/; do cp "$app/env/.env.example" "$app/env/.env"; done
```

The defaults already point at the local ports, and the game declares nothing.

Create the local database and apply migrations:

```bash
pnpm migrate:local
```

## Day to day

```bash
pnpm dev
```

Game on `http://localhost:6161`, backend on `http://localhost:8181`. Both bind
`0.0.0.0`, so another device on the same network can reach them — useful for
testing the PWA on a phone.

| | |
| --- | --- |
| `pnpm build` | build every app |
| `pnpm typecheck` | project references + the two standalone projects |
| `pnpm biome:check` / `pnpm biome:fix` | lint and format |
| `pnpm test` | Vitest across the workspace (backend runs on a real local D1) |
| `pnpm test:e2e` | Playwright smoke test against a running app |
| `pnpm logs` | the LAN log sink — device consoles forwarded to your terminal |
| `pnpm tail` | live Worker logs from the deployed backend |

Anything that edits source is done when typecheck, Biome, and the build all
pass; that gate is also what CI runs.

## Adding an endpoint

`apps/backend/src/http/routes/hello.routes.ts` is the worked example, and it is
short on purpose — it shows the whole contract in one file: rate limit on the
chain, `valid()` in the same tuple as the handler, a service doing the work,
`ok()` on the way out, and no try/catch, because a service throw is the global
catcher's job. `hello.service.ts` is its domain half, and
`hello.routes.test.ts` drives the real worker end to end.

To add a domain, copy those three, then mount it with one `.route()` line in
`src/http/routes/index.ts`.

`src/database/schema.ts` holds a single example table so the drizzle → migration
→ deploy path stays wired. No route reads it; replace it with a real domain, or
delete `src/database/` outright if the API stays stateless.

## Deploying

The pipeline is driven by `.github/deploy-units.jsonc`. An app deploys only if
it is listed there and has a `wrangler.toml`; apps inside one unit deploy in
order and stop on the first failure, and units run in parallel. Only apps
changed in the push actually deploy.

Adding an app is a `wrangler.toml` plus one line in that manifest — no workflow
edits.

**Only the game ships today.** It is the sole entry in the manifest, so a merge
to `main` deploys the Worker `abalone-game` and nothing else. `apps/backend` is
held back on purpose: its `wrangler.toml` still carries a `REPLACE_WITH_…`
`database_id`, so it would fail at the migrate step. CI warns on every run that
it has a `wrangler.toml` and isn't listed — that warning is the reminder.

**One environment.** `main` → production, and that is the whole story — no
staging branch, no `[env.*]` blocks, no per-env worker names. Run a manual
workflow dispatch to force-redeploy every unit (useful after rotating secrets,
which change no files, so `--affected` finds nothing).

**Setup, for the game:** add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
to the repo's `production` GitHub environment. That is the whole list — the game
declares no env of its own (`apps/game/env/schema.ts` is empty), so there is
nothing else to provision. The worker is served on `*.workers.dev` until a route
or custom domain says otherwise.

**Adding the backend later:** create the D1, paste its id, restore the unit in
the manifest, then add the backend's own env vars to the same environment:

```bash
pnpm exec wrangler d1 create abalone-backend-db
```

The deploy writes `env/.env` from `env/schema.ts` — the schema is the allowlist,
so only declared keys are ever written — then uploads it onto the Worker as
secrets. Nothing is configured in the Cloudflare dashboard. A database-backed
Worker deploys as upload → migrate → promote, so the schema is in place before
the new code goes live. Destructive DDL is blocked on PRs unless it carries an
explicit acknowledgment.

Rehearse any app's deploy without touching Cloudflare:

```bash
DRY_RUN=1 bash .github/scripts/deploy/app.sh apps/game
```

## Renaming it

The project name appears in `package.json` and in both `wrangler.toml` files
(worker and D1 names). The game's icons under `apps/game/public/` are named for
the game, not the project.

## Licence

MIT — see [LICENSE](LICENSE).
