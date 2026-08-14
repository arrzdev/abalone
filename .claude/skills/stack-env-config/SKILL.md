---
name: stack-env-config
description: Schema-first environment config: the four files per app, the typed registry proxy, where check:env runs and deliberately does not, and Vite's literal-token inlining rule. Use when adding or reading an env var, or when config is missing at runtime.
---

# Env and configuration

Every app's environment is **schema-first**: one Zod schema per app is the single declaration, and everything else — the runtime accessor, the local check, the CI seed, the deploy write, the Worker secrets — is derived from it. Read this before adding, renaming, or reading an env var.

## The four files per app (`apps/<app>/env/`)

| File | Role | Committed? |
|---|---|---|
| `schema.ts` | **the declaration** — a Zod object; the allowlist for everything downstream | yes |
| `registry.ts` | the typed runtime accessor (`env`, `envRegistry`, `Env`) | yes |
| `check-env.ts` | the CLI gate — `runEnvCheck` from `@repo/env-validation/cli-runner` | yes |
| `.env.example` | the documented contract, with placeholder values | **yes** |
| `.env` | real values | **no** — gitignored |

`.env.example` is the *only* documentation of a var that a fresh clone, CI, and a new worktree all see. **Adding a var means editing three things in the same change: `schema.ts`, `.env.example`, and your own `.env`.** Skip `.env.example` and CI's build seed silently loses the value.

## Adding an env var — the checklist

1. Add it to `env/schema.ts` with a **real Zod type** (`z.url()`, `z.string().min(16)`) and a `//comment` saying what it is. Optional vars use `.optional()` — and mean it, because `check:env` fails the app otherwise.
2. Add it to `env/.env.example` with a placeholder and a comment.
3. Add it to your local `env/.env`.
4. **Deploy-time:** the var must exist in the GitHub Environment (secret or var) for **every** environment that deploys — here that is `production`, the only one. `write-env-from-schema.ts` reads the schema as an allowlist and writes only declared keys, so an undeclared secret is silently dropped and a declared-but-missing one fails `check:env` **at deploy**, not on the PR.
5. **Frontend only:** a client-readable var **must** be prefixed `VITE_` and is baked at build time. See the Vite section below.

Adding a var is a config change with a deploy-time failure mode — say so in the handoff, and list the GitHub Environment keys the human has to create. That part is **human-only** (`stack-deploy-environments`).

## Reading env at runtime — the registry, never `process.env`

```ts
import { env } from "@/env/registry"

const url = env.VITE_BACKEND_URL
```

`createEnvRegistry` (`@repo/env-validation/registry-factory`) returns a **Proxy** over the validated values, so:

- **It throws if read before initialization.** The backend calls `envRegistry.setEnv(env)` in the Worker `fetch` entrypoint before touching anything else — a Worker gets its bindings per request, not at module load. Keep that call first.
- **A client app auto-hydrates from `import.meta.env`** at module scope (only keys declared in the schema), so there's no `setEnv` on the client.
- **Cloudflare bindings ride along on the same type.** The backend registry is generic over `CloudflareBindings` (`DB: D1Database`), so `env.DB` and `env.FRONTEND_URL` come from one typed object.
- **`env.internals.DEV`** is a deliberate escape hatch, not a general flag. The backend pins it `false` — a Worker cannot reliably detect prod at module load, and the old `process.env.CI !== "true"` check evaluated to `true` in production. Anything that needs dev-vs-prod on the backend derives it from validated config instead (`src/http/network-policy.ts`), which fails closed.

Never read `process.env` or `import.meta.env` directly in app code. The one sanctioned exception is `registry.ts` itself.

## `check:env` — where it runs and where it deliberately doesn't

| Stage | Runs `check:env`? | Why |
|---|---|---|
| `pnpm dev` | **yes** — a fatal preflight inside `scripts/dev.ts` | you can't start a half-configured app |
| PR CI (`ci.yml`) | **no** | a PR that adds a var must pass without provisioning prod; forks and any branch run clean |
| Deploy verify | **no** | same reason — it's a pure code/schema gate |
| Deploy (`deploy/app.sh`) | **yes**, with the real secrets + vars | this is where env *presence* is enforced |

Both CI and deploy-verify instead **seed `env/.env` from the committed `.env.example`** so the build has placeholder values — a client app bakes its `VITE_*` values in at build time, so an absent file is a broken bundle, not a late error. That's why the example file is load-bearing rather than decorative.

The practical consequence: **a missing env var is invisible on the PR and fails the deploy.** If you add one, say so explicitly in the handoff.

## Vite inlines `import.meta.env` only as a literal token

Vite string-replaces the **literal** `import.meta.env` at build — with the value for `import.meta.env.VITE_FOO`, or with the whole client env object for `key in import.meta.env` / `import.meta.env[key]`. Alias it first (`const e = import.meta.env; e[key]`) and the replacement never fires: the alias stays a runtime reference, the `VITE_*` registry ships **empty**, and every read is `undefined`.

Keep `import.meta.env` inline as a single token everywhere. A client app's `env/registry.ts` indexes `import.meta.env[key]` directly for exactly this reason — don't "clean it up" into a local variable. (Also in `stack-gotchas`.)

## Runtime wiring per platform

| App | How `.env` reaches the process |
|---|---|
| **Backend (Worker)** | `wrangler dev --env-file env/.env` locally; deploy uploads the same file as **Worker secrets** |
| **Client app (Vite)** | `envDir: "env"` in `vite.config.ts`; only `VITE_*` reaches the client bundle |

A non-`VITE_` var in a client app's schema will validate and then be `undefined` in the browser. If a value must be public, prefix it — and remember public means **shipped in the client JS**, so it can never be a secret (`stack-turnstile` has the canonical site-key/secret-key split).

## Fresh worktrees

`.env` is gitignored, so a new worktree has none and `pnpm dev` fails its preflight. Don't hand-copy — run `.claude/scripts/setup-worktree.sh`, which enumerates and copies every gitignored env file from the base checkout. See `stack-worktree-setup`.

## Related

`stack-deploy-environments` (GitHub Environments, per-branch secrets), `stack-worktree-setup`, `stack-gotchas`.
