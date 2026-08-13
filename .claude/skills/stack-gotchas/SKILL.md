---
name: stack-gotchas
description: Traps in this repo's own wiring: dev ports, worktree quirks, build-before-typecheck, the nativ framework layer, and Vite env inlining. Use when the dev server, worktree, generated files, or typecheck behaves unexpectedly.
---

# Repo gotchas

Non-obvious traps in **this codebase's own wiring** — dev servers, worktrees, the framework layer, build ordering. Facts that cost real time to rediscover, and that die with this repo.

Runtime behavior of the iOS/WebKit/PWA target is **not** here — that's `platform-ios-webkit`, because it stays true in the next project too.

## This is a compounding template repo

Every new project starts from a copy of the last. **"Unused" code is usually intentional scaffolding**, not dead code. Bias **additive / non-destructive**; do not delete things that merely look unused. If something seems orphaned, ask before removing.

Same rule applies to `.claude/skills/` itself — see `.claude/skills/README.md`.

## Dev ports

- Frontend dev: Vite **7171**, wrangler/CF inspector **9220**. Backend dev: **8181**, inspector **9218**. Both inspector ports are held by `pnpm dev` — **don't kill them** mid-session.
- **Frontend `vite build` binds inspector 9220** and collides with a running dev server. To verify a build while dev is up, temporarily set `inspectorPort: false`.
- **Isolate an autonomous run:** when *I* (not the human) run the dev server or a build in a loop / self-test, first remap each app's `ports.ts` (`appPort` **and** `supervisorPort`) to a throwaway high set so my process can't collide with the human's `pn run dev` in another worktree. **Roll `ports.ts` back to its committed defaults before handoff** — `git checkout -- apps/*/ports.ts`, then confirm `git diff` is clean — because the human tests the worktree on the ports he expects.

## Worktree setup (when working in a git worktree)

- Fresh worktrees lack gitignored `apps/{frontend,backend}/env/.env` and generated route files (`routeTree.gen.ts`, and nativ's `__root.gen.tsx` + `router.gen.tsx`) — copy `.env` from the main checkout, then run a **build once** to stamp the generated files, or an isolated typecheck fails on the missing modules. The bootstrap script does all of this: `stack-worktree-setup`.
- Run **verify inside the worktree**, not the main checkout. `pnpm biome:check` works there as-is: `biome.json` anchors the exclude to the repo root (`!!.claude`), so a worktree lints normally. Keep it anchored — `!!**/.claude` matches the `.claude` segment of the worktree's own path and silently checks 0 files.
- Read/Edit with **full worktree-prefixed paths** — bare repo paths resolve against main, not the worktree.

## Typecheck depends on a build having run

The frontend typecheck imports **generated** modules (`routeTree.gen.ts`, and nativ's `__root.gen.tsx` + `router.gen.tsx`), which only exist after a build stamps them. CI orders the steps `lint → build → typecheck` for exactly this reason.

So in a tree that has never been built, `pnpm typecheck` fails on missing modules that are not your fault and not fixable by editing code. **Build first, then typecheck.** (`pnpm build` also covers it; the verify gate in `CLAUDE.md` runs typecheck first because a working tree normally already has them.)

## nativ framework layer (`@repo/nativ`)

The PWA shell is a framework over TanStack Start, configured by `nativ.config.ts` at the app root.

- **`__root.gen.tsx` + `router.gen.tsx` are generated** (stamped by the `nativ()` vite plugin from the config, gitignored like `routeTree.gen.ts`). Never hand-edit — change `nativ.config.ts`; the plugin restamps on build/dev.
- **Component slots are dynamic-import thunks** with **literal** specifiers: `splashScreen: () => import("@/components/splash-screen")` (default export). A variable/template specifier throws — the plugin extracts the string statically.
- **Eject** by writing the real file (`layouts/_root.tsx`, `router.tsx`) — the plugin detects it (`existsSync`) and stops generating that file.
- **`nativ.config-loader` runs `enforce: "pre"`** so it stamps before Start resolves `router.entry`; keep it first in the plugin array.

## Consume `@repo/nativ` via its public interface only

Use the package's public props/exports. **Never** reach into internals or private hooks/attributes (e.g. a drawer's private `data-*`). Missing capability → stop and ask; do not patch the package from app work. See `stack-ui-shell`.

## Node ESM imports key

`#/*` is **invalid** in Node ESM (`ERR_INVALID_MODULE_SPECIFIER`). Packages that run under tsx/Node must use `#<package-slug>/*`. Only ever works under a bundler. Full rule: `core-imports`.

## Vite inlines `import.meta.env` only as a literal token

(Full env model: `stack-env-config`.) Vite string-replaces the **literal** `import.meta.env` at build — with the value for `import.meta.env.VITE_FOO`, or with the whole client env object for `key in import.meta.env` / `import.meta.env[key]`. Alias it first (`const e = import.meta.env; e[key]`) and the replacement never fires: the alias stays a runtime reference, the `VITE_*` registry ships **empty**, and every read is `undefined`. Keep `import.meta.env` inline as a single token everywhere — `apps/frontend/env/registry.ts` indexes `import.meta.env[key]` directly for exactly this reason (VL #13).
