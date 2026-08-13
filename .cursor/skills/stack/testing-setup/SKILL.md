---
name: testing-setup
description: >-
  This repo's test runners — Vitest + Cloudflare D1 pool (backend), happy-dom (frontend/pwa), Playwright (e2e), coverage. Load when running or wiring tests in this codebase.
---

# Testing setup (this repo)

Concrete runners and config. The portable *what/how* doctrine is in `core/testing`.

## Backend — Vitest + real local D1

- Runner: **Vitest** with **`@cloudflare/vitest-pool-workers`** (`apps/backend/vitest.config.ts`). Tests run inside a Workers runtime against **real local D1** — never a mocked DB.
- Helpers: integration scaffolding lives in `apps/backend/src/test-support/` — read it before writing a route/service test; reuse its app/context/seed helpers.
- Isolation: each test self-contained — seed and clear what it needs in `beforeEach`. Do not depend on order between tests.
- Examples to copy: `src/http/routes/sync.routes.test.ts`, `src/http/middlewares/rate-limit.test.ts`.
- Run: `pnpm --filter @repo/backend test` (script is `vitest run --passWithNoTests`).

## Frontend logic / hooks — happy-dom

- Proven in `@repo/nativ`: **Vitest + happy-dom + @testing-library/react** for hooks and pure UI logic (see `packages/nativ/src/hooks/*.test.ts`, `packages/nativ/src/components/avoid-keyboard/*.test.ts`).
- `apps/frontend` has **no runner yet** (`test` is a stub). To add hook/logic tests, mirror the `@repo/nativ` vitest config (happy-dom + Testing Library) rather than inventing a new setup.
- Do not unit-test pixel layout — that is E2E's job.

## End-to-end / self-test — Playwright

- Harness at repo root: `playwright.config.ts` + `e2e/` (e.g. `e2e/smoke.spec.ts`). Projects: **chromium** + **webkit** (webkit ≈ Mobile Safari for the iOS-PWA — desktop engine, not a real device).
- Run: **`pnpm test:e2e`**. Targets `E2E_BASE_URL` (default `http://127.0.0.1:7171`); `webServer` reuses a running dev server or boots the frontend.
- **Kept out of the per-app `test` task and out of CI by default** (needs a dev server up) — opt-in via the root script. Add a dedicated CI job only if the human wants gated E2E.
- Ad-hoc agent self-testing (not committed) → the **Playwright MCP** in `.mcp.json`; see `stack/debugging` → "Self-test in an isolated browser first".

## Coverage

- Turbo declares a `test:coverage` task. Add a member `test:coverage` script (`vitest run --coverage`) where wanted, then `pnpm exec turbo run test:coverage --filter=<member>...`.

## Commands

| Goal | Command |
|------|---------|
| All tests | `pnpm test` (turbo) |
| One member | `pnpm --filter @repo/<member> test` |
| Backend only | `pnpm exec turbo run test --filter=@repo/backend...` |
| Coverage (where scripted) | `pnpm exec turbo run test:coverage --filter=<member>...` |
