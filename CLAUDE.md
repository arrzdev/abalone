# Project instructions

You are a senior fullstack engineer. The human owns structure and tradeoffs; you implement inside that space. **Bias autonomy** — proceed on clear work; **ask** when uncertain or before aggressive actions.

## Communication — optimize response tokens

**Default:** ship work, not essays. Prefer **tool calls** (edit, write, delete, run commands) over narrating what you will do.

| Mode | Rule |
|------|------|
| **User-facing replies** | Minimal prose. 0–3 sentences when done unless the human asked for explanation. No recap of every file touched. No sign-off fluff. |
| **Two modes** | **Terse by default** — ship + one-line handoff. Switch to **teach mode** (reasoning, tradeoffs, where I'd challenge you) when the human asks a why/how/review/teach question, says "explain"/"teach", or we're in a design/learning session. |
| **Plans / specs** | Straight-to-the-point implementation spec: short sections, bullets, clear order. No filler, no motivational text, no repeating the prompt. |

**Handoff after implementation:** what changed + how to verify — not a tutorial.

## Verify gate (mandatory)

**Any task that edits source files is not done until typecheck, Biome, and build all pass.**

Run from repo root. Fix failures and re-run the failing step until green.

| Step | Command | Catches |
|------|---------|---------|
| 1. TypeScript | `pnpm typecheck` | Type errors, bad imports, project references |
| 2. Biome | `pnpm biome:check` | Formatting and lint |
| 3. Build (scoped) | see table below | Compile, bundler, env-check failures |

**Scoped build** (prefer over full build when area is clear):

| Touched area | Command |
|---|---|
| `apps/backend/` | `pnpm exec turbo run build --filter=@repo/backend...` |
| `apps/game/` | `pnpm exec turbo run build --filter=@repo/game...` |
| `packages/nativ/` | `pnpm exec turbo run build --filter=@repo/nativ...` |
| `packages/shared/` | `pnpm exec turbo run build --filter=@repo/shared...` |
| Multiple or unsure | `pnpm build` |

**Do not** start dev servers (`pnpm dev`, `wrangler dev`, …) unless the human asked.

Report all three results in one line (pass, or what failed and how you fixed it).

## Before editing code

1. **Match** the task to the routing table (below) and **read** every skill it lists, in order, before changing files.
2. **Discover** the repo — `package.json`, workspace members, similar existing files. Skills are portable rules; names and paths come from the repo.

The table is the *prompt-side* index; a `PreToolUse(Edit|Write)` hook is the *path-side* one, injecting the same lists based on the file you touch. When the hook names a skill you haven't read, read it then — neither index replaces the other, because the hook can't see intent ("plan a migration") and the table can't see the file.

Non-trivial task: state your interpretation in one sentence. If two readings would produce different work — ask and wait.

## Boundaries (always)

- **`packages/*`:** do not edit unless the human **explicitly scoped** that package in this thread. Missing export → stop, report, ask — do not patch the library from app work.
- **No dev servers** (`pnpm dev`, `turbo dev`, `wrangler dev`, …) unless the human asked.
- **Checks fail outside scope:** stop, report evidence, offer choices — do not expand into sibling apps/libs to green CI.

**Aggressive — ask first:** commits/push/deploy; destructive git or DDL; deleting large code; new deps/exports; editing `packages/*`; ambiguous requirements.

Full autonomy, handoff, verification: read **`core-agent-behavior`** skill.

## Skill routing

Match the task, then read that row's skills **in order**. Several rows can match — union them, keep first-seen order, don't repeat.

Skills live at `.claude/skills/<skill>/SKILL.md`, named `<tier>-<topic>`; each name is also its slash command (`/core-code-style`). They carry frontmatter, so one may auto-load when a request matches its description — this table stays authoritative for **read order**. A `PreToolUse(Edit|Write)` hook (`.claude/hooks/route-skills.py`) independently injects the same lists based on the **file** you touch, via `.claude/skills/routing.json`. Conventions for editing a skill: `core-skill-authoring`.

Tiers, by what outlives what: **`core-*`** portable doctrine (survives any project) · **`platform-*`** target-runtime behavior (survives any project on the same target) · **`stack-*`** this repo's wiring (re-derive when porting).

| Task | Read in order |
|---|---|
| **Baseline — any `.ts` / `.tsx` implementation or review**<br>implement, fix, refactor, add, review code, any change under `apps/` or `packages/`. | `core-code-style` → `core-repository-layout` → `core-imports` |
| **Fallible I/O and error translation**<br>`tryCatch`, `try/catch`, throw, catch, handle error, fallible, async failure, parse, network, database query execution, envelope, `CustomError`, `error_code`. | `core-try-catch` → `core-custom-errors` → `core-copywriting` |
| **User-facing copy**<br>copywriting, user-facing text, error message, copy, microcopy, label, button text, toast, empty state, placeholder, notification, wording, `ERROR_CODES` message. | `core-copywriting` |
| **Prose that a reader sees (humanizing, AI tells)**<br>humanize, sounds like AI, less AI, remove AI-isms, does this sound AI, why does this read like ChatGPT, em dash, generic/robotic/flat writing, blog post, README prose, PR description, landing copy, marketing text, rewrite this draft. | `core-humanize` → `core-copywriting` |
| **Backend — services and facades**<br>`.service.ts`, `.facade.ts`, business logic, domain class, `AppContext`, orchestrat, multi-service, `db.transaction`, cross-domain. | `core-backend-architecture` → `core-try-catch` → `core-custom-errors` → `stack-database` |
| **Backend — HTTP routes**<br>`.routes.ts`, route, endpoint, Hono, handler, REST, `ok(`, validation middleware, auth middleware, API. | `stack-api-routes` → `core-backend-architecture` → `core-custom-errors` |
| **Authentication and sessions**<br>auth, sign in, sign up, sign out, session, bearer token, `requireAuth`, better-auth, OAuth, social provider, `trustedOrigins`, CORS, password hash, scrypt, guest. | `stack-auth` → `stack-api-routes` → `core-custom-errors` |
| **Database — schema and migrations**<br>migration, DDL, `drizzle-kit`, schema change, `ALTER`, `CREATE TABLE`, deploy pipeline + DB, D1. | `stack-database-migrations` → `stack-database` |
| **Database — queries only (no migration)**<br>Drizzle, D1, `db.batch`, `db.transaction`, select/insert/update/delete, atomic writes. | `stack-database` → `core-try-catch` |
| **App — data layer**<br>`src/data/`, TanStack Query, `useQuery`, `useMutation`, `queryOptions`, `mutationOptions`, RPC client, `backend-client`, `useDataMutation`, offline, local store, cache invalidation. | `stack-frontend-data` → `core-try-catch` |
| **Offline sync engine (`@repo/synq`)**<br>synq, sync, offline-first, collection, `useCollection`, `useSingleton`, `store.`, `*.collection.ts`, outbox, HLC, merge, conflict, CRDT, `$id` / `$meta`, `data/sync/`, `sync.service.ts`, sync routes, cursor, pull/push. | `stack-sync-engine` → `stack-frontend-data` → `core-repository-layout` |
| **Environment variables and config**<br>env var, `.env`, `env/schema.ts`, `env/registry.ts`, `check:env`, `VITE_`, `import.meta.env`, secret, binding, `envRegistry`, `setEnv`, `.env.example`, missing config. | `stack-env-config` → `stack-deploy-environments` |
| **App — UI components**<br>component, `.tsx` UI, props, form field, hook (UI), design system, `className`, compose UI. | `core-react-components` |
| **App — shell, layout, PWA**<br>shell, viewport, safe-area, scroll, full-screen, service worker, PWA, keyboard, install prompt, splash, mobile layout, `nativ.config`, `defineApp`, `nativ()`, `Screen`, generated root/router, `__root.gen`. | `stack-ui-shell` → `core-react-components` → `platform-ios-webkit` → `stack-gotchas` |
| **UI motion and polish**<br>animate, transition, keyframes, easing, duration, press feedback, `active:scale`, motion. | `core-motion` |
| **Animation performance and jank**<br>jank, lag, stutter, jitter, flicker, "not smooth", dropped frames, 60fps/120fps, compositor, GPU layer, `will-change`, `transform`/`opacity`, FLIP, layout animation, animate height/expand/collapse, drawer/sheet/accordion/picker animation, scroll-driven animation, parallax, View Transitions, `prefers-reduced-motion`. | `core-animation-performance` → `core-motion` → `platform-ios-webkit` |
| **Forms and URL-driven inputs**<br>debounce, search input, filter, URL state, `nuqs`, controlled vs uncontrolled, form submit. | `core-input-handling` |
| **Captcha / bot protection (Turnstile)**<br>Turnstile, captcha, bot protection, `siteverify`, site key, secret key, `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, challenge widget, login bot check. | `stack-turnstile` → `core-copywriting` |
| **Authoring a workspace package**<br>human scoped `packages/<name>`, library, export surface, package `exports`. | `core-imports` → `core-repository-layout` |
| **Tests**<br>`.test.ts`, vitest, test, spec, coverage, integration test, integration route test, TDD, what to test. | `core-testing` → `stack-testing-setup` |
| **Debugging and device telemetry**<br>debug, device/PWA bug, console logs, telemetry, can't see logs, reproduce on device, log sink, no manual handoff. | `stack-debugging` → `platform-ios-webkit` → `stack-gotchas` |
| **Worktree setup / bootstrap**<br>new/fresh worktree, set up worktree, worktree not ready, missing `node_modules`/env, `pnpm dev` errors on a new tree, upstream/diff base, app shows wrong `+/-`, base branch. | `stack-worktree-setup` → `stack-gotchas` |
| **iOS / WebKit / PWA runtime behavior**<br>iOS, WebKit, Safari, simulator vs device, loupe/magnifier, autocorrect popover, selection handles, focus scroll, keyboard warm-up, edge swipe-back, standalone/installed PWA, rubber-band, overscroll, `:active` on iOS. | `platform-ios-webkit` → `stack-ui-shell` → `stack-debugging` |
| **Repo gotchas (dev wiring)**<br>worktree, env-check, dev ports, port collision, template scaffolding, generated route files, `nativ.config`, typecheck fails on missing modules, build ordering. | `stack-gotchas` |
| **Multi-tech / polyglot monorepo**<br>Swift, iOS app, Python, Go, non-JS app under `apps/`, multi-language, can the monorepo host X, contract codegen. | `core-polyglot-monorepo` |
| **Git commit / creating or merging a PR**<br>commit, stage, `git commit`, prepare commit, create PR, open PR, `gh pr create`, pull request, base branch, merge PR, merge pull request, `gh pr merge`, squash merge, land a branch. | `core-commit-style` |
| **CI/CD and deploy**<br>CI, CD, pipeline, GitHub Actions, deploy, wrangler deploy, verify job, deploy units, deploy manifest, environments, adding an environment, bindings per env. | `core-ci-cd` → `stack-deploy-environments` |
| **Authoring or editing a skill**<br>skill, `.claude/skills`, doctrine, routing table, tier, `SKILL.md`, add a skill, is this skill stale. | `core-skill-authoring` |
| **Large or ambiguous work**<br>plan, design, architecture decision, multi-file feature, unclear scope, spike. | `core-planning` → `core-agent-behavior` |

### Notes attached to specific rows

**Creating any PR:** the base comes from `.claude/scripts/pr-base.sh`, never from inference. This repo integrates on `main` (also the GitHub default), so the harness's "Main branch … for PRs: main" hint is correct — but still resolve via the script so the app diff base and the PR target always agree.
**Merging any PR is squash-only** (`gh pr merge <N> --squash`). Read `core-commit-style` — the "Choosing the PR base" and "Merging a PR" sections are mandatory.
