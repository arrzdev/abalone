---
name: stack-testing-setup
description: Which members have test runners and with what, the backend's real-local-D1 setup, Playwright E2E, and why a green pnpm test does not prove coverage. Use when adding a test, choosing a runner, or running the suite.
---

# Testing setup (this repo)

Concrete runners and config. The portable *what/how* doctrine is in `core-testing`.

## Who has tests, and with what

| Member | Runner / env | Notes |
|---|---|---|
| `@repo/backend` | Vitest + `@cloudflare/vitest-pool-workers` | real local D1 inside a Workers runtime |
| `@repo/nativ` | Vitest + **happy-dom** + Testing Library | hooks, gesture engine, vite-plugin units |
| `@repo/env-validation` | Vitest (node) | schema/registry/parser |
| `@repo/dev` | Vitest (node) | |
| `@repo/game` | Vitest + **happy-dom** | `apps/game/vitest.config.ts`; data-layer logic today, hooks when one needs it |
| `@repo/shared` | no `test` script | |

Every vitest config **aliases the package's own `#<slug>` self-import** to `src/` so tests use the same specifier the source does — never relative paths (`core-imports`). Copy that pattern when adding a runner to a package.

## Backend — Vitest + real local D1

- Runner: `apps/backend/vitest.config.ts`. Tests run inside a Workers runtime against **real local D1** — never a mocked DB.
- Helpers: `apps/backend/src/test-support/` — `apply-migrations` runs the real migrations into the test D1. It is the only helper left; the request builder and the per-domain clears went with the domains they served. Put a shared helper back there the moment a second test file needs it, not before.
- Isolation: each test self-contained — seed and clear what it needs in `beforeEach`. Do not depend on order between tests.
- Examples to copy: `src/http/routes/hello.routes.test.ts`, `src/http/middlewares/rate-limit.test.ts`.
- Run: `pnpm --filter @repo/backend test`.

## App logic / hooks — happy-dom

- The pattern is proven in `@repo/nativ`: Vitest + happy-dom + `@testing-library/react` (`packages/nativ/src/hooks/*.test.ts`, `packages/nativ/src/components/avoid-keyboard/*.test.ts`).
- `apps/game` now mirrors it — `apps/game/vitest.config.ts`, happy-dom, the `@/` and `@/env/` aliases from tsconfig. Examples: `src/data/realtime/invalidate.test.ts`, `src/data/realtime/channel.test.ts`.
- **`test.env` is not optional there.** The env registry hydrates from `import.meta.env` at module scope, so anything importing `src/data/**` throws before a test runs unless the declared keys are present. They are set as literals in the config, never read from a local `.env` — a suite that only passes on a machine with env files is not a suite.
- `@testing-library/react` is **not** installed in `apps/game` yet; add it with the first test that renders a hook, not before.
- Do not unit-test pixel layout — that is E2E's job.

## End-to-end / self-test — Playwright

- Harness at repo root: `playwright.config.ts` + `e2e/` (`e2e/smoke.spec.ts`). Projects: **chromium** + **webkit** (webkit ≈ Mobile Safari for the iOS-PWA — desktop engine, not a real device).
- Run: **`pnpm test:e2e`**. Targets `E2E_BASE_URL` (default `http://127.0.0.1:7171`); `webServer` reuses a running dev server or boots the frontend.
- **Kept out of the per-app `test` task and out of CI by default** (needs a dev server up) — opt-in via the root script. Add a dedicated CI job only if the human wants gated E2E.
- Ad-hoc agent self-testing (not committed) → the **Playwright MCP** in `.mcp.json`; see `stack-debugging` → "Self-test in an isolated browser first".

## What CI actually runs

`pnpm exec turbo run test` — so a member with no `test` script contributes nothing, and `--passWithNoTests` means an empty suite is green. **A green `pnpm test` does not prove your area is covered.** Check the table above for whether a runner even exists where you changed code.

`test` declares `dependsOn: ["^build"]` and `cache: false` in `turbo.json`, so tests always re-run and always see fresh package builds.

## Coverage

Turbo declares a `test:coverage` task, but **no member defines the script yet**. Add `"test:coverage": "vitest run --coverage"` to the member you want, then `pnpm exec turbo run test:coverage --filter=<member>...`.

## Commands

| Goal | Command |
|------|---------|
| All tests | `pnpm test` (turbo) |
| One member | `pnpm --filter @repo/<member> test` |
| Backend only | `pnpm exec turbo run test --filter=@repo/backend...` |
| E2E | `pnpm test:e2e` |
| Coverage (once scripted) | `pnpm exec turbo run test:coverage --filter=<member>...` |
