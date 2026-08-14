# Abalone monorepo

The Abalone game and the accounts behind it: a pnpm + Turborepo monorepo of
Cloudflare Workers, wired to deploy from GitHub Actions. The API half is a Hono
worker on D1 with username and password sign-in, profile pictures on R2, and a
deploy pipeline that grows by one line per new app.

## Layout

| | |
| --- | --- |
| `apps/game` | the Abalone game — React 19 on the `@repo/nativ` PWA shell, TanStack Start routing, served by a Worker |
| `apps/backend` | Hono on a Worker. D1 + Drizzle, the layered http/services structure, better-auth sessions, R2 avatars |
| `packages/nativ` | the PWA shell framework: app config, generated router, native-feeling components, hooks, service worker |
| `packages/shared` | the kernel the apps import — `tryCatch`, logging, the Hono endpoint factory |
| `packages/env-validation` | schema-checked env with one registry per app |
| `packages/dev` | the dev runner: port clearing, LAN log sink, local cron setup |
| `.github/` | CI, the deploy pipeline, and `deploy-units.jsonc` — what deploys and in what order |
| `.claude/`, `.cursor/` | agent skills, routing hooks, and the verify gate |

Apps consume packages through workspace exports (`@repo/nativ`, `@repo/shared`,
…) and never reach past a package's public entry points. Every package here has
a consumer; nothing is kept on spec.

The game calls the backend for one thing: who you are. Sign-in, sign-out and the
profile picture go over the API; everything about actually playing runs on the
device, so offline play works signed out and with the network off. The one thing
that crosses the two workspaces at build time is a type, the RPC routes
interface, which is why `apps/game` depends on `@repo/backend` and imports
nothing from it at runtime.

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

The defaults already point at the local ports, so nothing needs editing to run
the two apps side by side.

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

`apps/backend/src/http/routes/profile.routes.ts` is the shape every route
follows, and it shows the whole contract in one file: rate limit first on the
chain, then `requireAuth()`, then handlers that only describe the success path,
with a service doing the work and `ok()` on the way out. There is no try/catch,
because a service throw is the global catcher's job.
`src/services/profile.service.ts` is its domain half, and
`profile.routes.test.ts` drives the real worker against a real local D1.

To add a domain, copy those three, then mount it with one `.route()` line in
`src/http/routes/index.ts`.

## Accounts

Sign-in is a username and a password. No email, no OAuth, no verification.
better-auth's `username` plugin owns the handle, and the email column it insists
on is derived server-side from that handle and never shown. Sessions are bearer
tokens in `localStorage` rather than cookies, because the app and the API are
different origins and a cross-origin cookie is a fight with Safari that an
installed PWA keeps losing.

Profile pictures live in R2 under a content-addressed key, `avatars/<sha256>.webp`,
so a picture's URL never changes and its `Cache-Control` can say `immutable`. The
object carries that header itself, which keeps the read path off the Worker
entirely: browsers and the Cloudflare edge answer it, and R2 is only touched on a
cold miss. Uploads are resized to a 256px square in the browser before they are
sent, so no image library ships to the Worker.

Dev stays entirely local. The R2 binding points at a bucket miniflare invents on
the spot, so `pnpm dev` needs no network and no Cloudflare account — but wrangler
emulates the binding, not public-bucket HTTP access, so that bucket has no address
an `<img>` can reach. `GET /api/v1/avatars/*` stands in for the custom domain and
serves the headers the object itself carries, so the caching behaviour under test
is the one that ships. It is gated on the same config-derived signal as CORS, an
all-localhost `FRONTEND_URLS`, so against an https frontend it answers 404 and the
production read path is the only one there is.

## Deploying

The pipeline is driven by `.github/deploy-units.jsonc`. An app deploys only if
it is listed there and has a `wrangler.toml`; apps inside one unit deploy in
order and stop on the first failure, and units run in parallel. Only apps
changed in the push actually deploy.

Adding an app is a `wrangler.toml` plus one line in that manifest — no workflow
edits.

**Two units, both shipping.** `backend` and `game` are separate entries, because
the game is a static PWA that only reaches the API at runtime, so neither has to
land before the other.

**One target, selected explicitly.** `main` goes to production and there is no
staging branch. The backend still carries an `[env.production]` block, because
`wrangler dev` and the deploy need different bindings: the top level names the
local database and bucket, and the deploy passes `--env production` to every
wrangler call that reads the file. Bindings do not inherit across a named
environment, so that block repeats the full set rather than patching the one
above. The game has no environments at all, since its config comes from the Vite
build rather than from `wrangler.toml`.

Run a manual workflow dispatch to force-redeploy every unit. That is what to do
after rotating secrets, which change no files, so `--affected` finds nothing.

**Setup.** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` go in the repo's
`production` GitHub environment, along with the values both apps declare:

| Key | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | 16 characters or more, from `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `https://api.abalone.tudu.dev` |
| `FRONTEND_URLS` | `https://abalone.tudu.dev,https://babaluje.tudu.dev` — every origin the game answers on, comma-separated |
| `AVATAR_PUBLIC_URL` | `https://cdn.abalone.tudu.dev` |
| `VITE_BACKEND_URL` | `https://api.abalone.tudu.dev`, baked into the game's build |

Then create the database and the bucket. Both already exist on this account and
`apps/backend/wrangler.toml` carries the database's id; on a fresh account,
paste the new id over it:

```bash
pnpm exec wrangler d1 create abalone-backend-db
```

```bash
pnpm exec wrangler r2 bucket create abalone-avatars
```

The domains are the dashboard's. Attach `abalone.tudu.dev` and
`babaluje.tudu.dev` to the `abalone-game` Worker — the game answers on both,
which is why `FRONTEND_URLS` is a list — `api.abalone.tudu.dev` to
`abalone-backend`, and `cdn.abalone.tudu.dev` to the `abalone-avatars` bucket
under Settings, Public access, Custom domain. There is no wrangler equivalent
for the bucket one.

Do all of that before merging. A missing environment value is invisible on the
PR, because CI seeds `.env` from `.env.example` and deliberately does not run
`check:env`; it fails at deploy instead.

The deploy writes `env/.env` from `env/schema.ts`, which is the allowlist, so
only declared keys are ever written, and then uploads it onto the Worker as
secrets. Nothing is configured in the Cloudflare dashboard except the two
domains. A database-backed Worker deploys as upload, then migrate, then promote,
so the schema is in place before the new code goes live. Destructive DDL is
blocked on PRs unless it carries an explicit acknowledgment.

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
