---
name: gotchas
description: >-
  Non-obvious traps in this iOS-PWA codebase — device-vs-sim reality, iOS WebKit text overlays, suppress-then-reimplement, edge-swipe vs scroll-lock, dev ports, worktree setup. Load before debugging device/PWA behavior or touching dev/worktree setup.
---

# Repo & platform gotchas

Hard-won, non-obvious traps specific to this codebase and its iOS-PWA target. Read before debugging device/PWA behavior or touching the dev/worktree setup. These are facts that cost real time to rediscover.

## This is a compounding template repo

Every new project starts from a copy of the last. **"Unused" code is usually intentional scaffolding**, not dead code. Bias **additive / non-destructive**; do not delete things that merely look unused. If something seems orphaned, ask before removing.

## Trust the device over the simulator

For gesture, keyboard, scroll, and text-overlay bugs: **the iOS Simulator lies**. Several WebKit behaviors only reproduce on a real device. When the human reports something from their device, believe the repeated on-device report over one clean sim run. **Instrument and reproduce on the real device before changing code** — don't guess-and-check. (How to capture device logs without manual handoff: `stack/debugging`.)

## iOS WebKit text overlays are not CSS-fixable

| Overlay | Reality | Only fix |
|---------|---------|----------|
| Autocorrect / spellcheck popover, selection handles, callout | Detach on scroll; **cannot** be moved/styled from web | Disable autocorrect/spellcheck statically on the field |
| Double-tap magnifier **loupe** | WebKit bug 231161; not CSS-controllable; **won't reproduce in sim** | JS `touchstart` patch (`use-suppress-text-magnifier`) |
| Caret repaint glitch | The exception — fixable | App-wide caret repaint fix |

Don't burn time trying to reposition these with CSS. Pick the static-disable or JS-suppression path.

## iOS focus scroll races `AvoidKeyboard` (and ignores `scroll-behavior`)

Focusing a field triggers **two** scrolls: WebKit's own "reveal the focused element", which is always instant, and `AvoidKeyboard`'s `scrollTo({ behavior: "smooth" })` two rAFs later. Which one you actually see is decided by **keyboard warm-up** (device-measured on the playground):

| Focus | Keyboard commits | Scroll range when `AvoidKeyboard` runs | Result |
|-------|------------------|----------------------------------------|--------|
| First (cold keyboard) | ~130ms | **0** — the reservation hasn't landed, nothing can scroll yet | `AvoidKeyboard` does the whole 200px → **smooth** (18 intermediate positions) |
| Every one after (warm) | ~2-3ms | already full | WebKit snapped there first → **instant**, `AvoidKeyboard` has ~7px left to do |

So "smooth on the first focus, snappy after that" is **expected behavior, not a regression** — don't re-debug it.

`scroll-behavior: smooth` on the scroller does **not** fix it: measured, no change (`scrollTop` still goes `0 → 200` in a single frame, zero intermediate positions).

**Confirmed by patching `scrollTo` and reading `scrollTop` synchronously inside the call**, so this is measured, not inferred:

| Focus | `scrollTop` when `AvoidKeyboard`'s `scrollTo` ran | Who moved it |
|-------|---------------------------------------------------|--------------|
| First | **0** — still at the origin | the primitive, and it animated properly (19 frames) |
| Warm  | **200** — already at the destination | WebKit's native focus reveal got there first; the call is a no-op |

Same call, same `behavior: "smooth"`, opposite outcomes — the primitive animates fine whenever it actually has work. So there is **nothing to fix in `AvoidKeyboard`**, and no web-facing lever: the native reveal is not suppressible for a user-initiated tap (`preventScroll` only applies to programmatic `focus()`).

Two details worth knowing if you ever revisit: the primitive targets `top: 207` on a scroller whose max is `200`, so on a warm focus it is doubly a no-op (already there, and the target clamps). And `scroll-behavior: smooth` on the scroller does **not** help — measured, no change; WebKit's reveal ignores it.

## Suppress-native-then-reimplement

Native mobile browser behaviors (keyboard pushing layout, overscroll/rubber-band) are **deliberately suppressed**, then reimplemented in-app (e.g. keyboard handled via `AvoidKeyboard`, not native push). **Do not remove the suppression** thinking it's a bug — you'd reintroduce the native behavior the app intentionally replaced.

## PWA edge-swipe vs scroll-lock

iOS edge swipe-back **cannot** be blocked by `preventDefault`. The drawer's scroll-lock *does* incidentally block it — so scope scroll-lock to the drawer, **never app-wide**, or you kill back-navigation.

## Standalone PWA has no URL bar

Installed/standalone mode has no browser chrome. **Every reachable page needs an in-app nav affordance** — you can't rely on the URL bar or back button being visible.

## Consume `@repo/nativ` via its public interface only

Use the package's public props/exports. **Never** reach into internals or private hooks/attributes (e.g. a drawer's private `data-*`). Missing capability → stop and ask; do not patch the package from app work. See `stack/ui-shell`.

## Dev ports

- Frontend dev: Vite **7171**, wrangler/CF inspector **9220**. Backend dev: **8181**, inspector **9218**. Both inspector ports are held by `pnpm dev` — **don't kill them** mid-session.
- **Frontend `vite build` binds inspector 9220** and collides with a running dev server. To verify a build while dev is up, temporarily set `inspectorPort: false`.
- **Isolate an autonomous run:** when *I* (not the human) run the dev server or a build in a loop / self-test, first remap each app's `ports.ts` (`appPort` **and** `supervisorPort`) to a throwaway high set so my process can't collide with the human's `pn run dev` in another worktree. **Roll `ports.ts` back to its committed defaults before handoff** — `git checkout -- apps/*/ports.ts`, then confirm `git diff` is clean — because the human tests the worktree on the ports he expects.

## Worktree setup (when working in a git worktree)

- Fresh worktrees lack gitignored `apps/{frontend,backend}/env/.env` and generated route files (`routeTree.gen.ts`, and nativ's `__root.gen.tsx` + `router.gen.tsx`) — copy `.env` from the main checkout, then run a **build once** to stamp the generated files, or an isolated typecheck fails on the missing modules.
- Run **verify inside the worktree**, not the main checkout. `pnpm biome:check` works there as-is: `biome.json` anchors the exclude to the repo root (`!!.claude`), so a worktree lints normally. Keep it anchored — `!!**/.claude` matches the `.claude` segment of the worktree's own path and silently checks 0 files.
- Read/Edit with **full worktree-prefixed paths** — bare repo paths resolve against main, not the worktree.

## nativ framework layer (`@repo/nativ`)

The PWA shell is now a framework over TanStack Start, configured by `nativ.config.ts` at the app root.

- **`__root.gen.tsx` + `router.gen.tsx` are generated** (stamped by the `nativ()` vite plugin from the config, gitignored like `routeTree.gen.ts`). Never hand-edit — change `nativ.config.ts`; the plugin restamps on build/dev.
- **Component slots are dynamic-import thunks** with **literal** specifiers: `splashScreen: () => import("@/components/splash-screen")` (default export). A variable/template specifier throws — the plugin extracts the string statically.
- **Eject** by writing the real file (`layouts/_root.tsx`, `router.tsx`) — the plugin detects it (`existsSync`) and stops generating that file.
- **`nativ.config-loader` runs `enforce: "pre"`** so it stamps before Start resolves `router.entry`; keep it first in the plugin array.

## Node ESM imports key

`#/*` is **invalid** in Node ESM (`ERR_INVALID_MODULE_SPECIFIER`). Packages that run under tsx/Node must use `#<package-slug>/*`. Only ever works under a bundler. See `core/imports`.

## Vite inlines `import.meta.env` only as a literal token

Vite string-replaces the **literal** `import.meta.env` at build — with the value for `import.meta.env.VITE_FOO`, or with the whole client env object for `key in import.meta.env` / `import.meta.env[key]`. Alias it first (`const e = import.meta.env; e[key]`) and the replacement never fires: the alias stays a runtime reference, the `VITE_*` registry ships **empty**, and every read is `undefined`. Keep `import.meta.env` inline as a single token everywhere — `apps/frontend/env/registry.ts` indexes `import.meta.env[key]` directly for exactly this reason (VL #13).
