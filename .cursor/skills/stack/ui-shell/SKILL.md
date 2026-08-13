---
name: ui-shell
description: >-
  PWA shell, viewport contract, scroll regions, safe-area, three-tier UI consumption, service worker
  bootstrap. Load for layouts, full-screen mobile, scroll fixes, shared UI package consumption.
---

# UI shell and shared UI consumption

Runnable frontends consume a **shared UI package** via workspace exports. Do not author that package during app feature work unless the human scoped it.

## Non-negotiables

1. **Prefer the shared package** — check exports before rolling your own button, drawer, input, etc.
2. **Never edit the shared UI package** from app work — report missing capability; ask.
3. **Customize at the call site** — `className`, composition slots, props.
4. **App-local wrappers OK** — thin files that import shared components and add brand-only classes.

## Three-tier UI pattern

```
feature routes
  → app components/ui          (Tier 2 — branded wrappers)
    → shared UI package        (Tier 1 — behavior, a11y, neutral baseline)
```

| Tier | Where | Rule |
|------|-------|------|
| **3** | App features | Prefer `AppButton`, `AppInput`, etc. from app `components/ui` |
| **2** | `components/ui/*.tsx` | Wrap Tier 1 with brand `className` via `cn()`; `ComponentPropsWithRef<typeof Base…>` |
| **1** | Shared UI package | Behavior + neutral gray baseline; edit only when human scopes the package |

**Compound wrappers:** export `AppRoot` + `AppRoot.Part` via `Object.assign`; each part renders the base part with brand classes and matching `displayName`.

## Viewport contract (native mobile feel)

The **document does not scroll**. Root sets `touch-none` / `overscroll-none`; app shell clips with `overflow-hidden`.

| Need | Pattern |
|------|---------|
| Vertical pane scroll | `scrollable-y` on the scrolling element |
| Horizontal scroll | `scrollable-x` |
| Tappable control | `clickable` when enabled |
| Selectable text | native inputs or `.selectable` |

**Flex chain for nested scroll** — every flex child between shell and scroll node needs `min-h-0` (and usually `flex-1`):

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  <div className="flex min-h-0 flex-1 flex-col scrollable-y p-safe-offset-6">
    {/* page content */}
  </div>
  <footer className="shrink-0 pb-safe-or-2" />
</div>
```

**Do not** put `overflow-auto` on `body` or the app shell root. **Do not** rely on window scroll.

## Safe-area

Use `pt-safe`, `pb-safe`, `px-safe`, `p-safe-offset-*`, `*-safe-or-*` on headers, footers, full-bleed screens.

## PWA vs browser

- `app:` variant — `display-mode: standalone` (installed PWA)
- `web:` variant — in-browser tab

Verify layouts in mobile browser **and** standalone PWA when shipping a manifest.

## Bootstrap checklist

The shell is a **framework layer** (`@repo/nativ`) driven by one file — `nativ.config.ts` at the app root:

1. **`nativ.config.ts`** is the single source of truth (`defineApp({ … })`) — identity, theme colors, icons dir, orientation, `styles` path, `sw` entry, screen slots (`splashScreen`/`orientationGuardScreen`/`notFoundScreen`/`providers`) as `() => import("…")` thunks (default exports), **and** all routing wiring in one `router` block: rendering mode (`render`), an optional `serverEntry`, the build route-generator paths (`generatedRouteTree` / `routesDirectory` / `virtualRouteConfig` / `quoteStyle`, required — no magic directories), and any runtime `createRouter` option. nativ routes each key to the right TanStack Start layer. (The **client entry** is Start's built-in default — with `StrictMode`, recommended; eject by writing `src/client.tsx` for a custom one.)
2. **`vite.config.ts`** adds one plugin — a bare `nativ()`, **no arguments** (an async plugin factory: Vite awaits it and flattens the returned array, so no `await`/spread). It reads `nativ.config.ts` and wires TanStack Start, the generated web manifest (no hand-maintained `manifest.json`), and the service-worker precache + derived build tag. Changing a build key in `router` (`render` or the generator paths) needs a **dev-server restart** — those configure Start once at startup.
3. **Generated, never edited:** `src/routing/layouts/__root.gen.tsx` and `src/router.gen.tsx` are stamped from the config (gitignored, like `routeTree.gen.ts`). Change `nativ.config.ts`, not these.
4. **App stylesheet** imports Tailwind, safe-area utilities, then `@repo/nativ/styles.css` (once). It's wired via the config `styles` path — no `?url` import in app code.
5. **Service worker** stays app-authored at `src/sw.ts` (full control); nativ bundles it, injects precache, and provides the `__NATIV_BUILD_TAG__` constant.
6. **Eject** any generated piece by writing the real file (`layouts/_root.tsx`, `router.tsx`, `client.tsx`) — nativ detects it and defers.

Bumping TanStack Start needs a smoke test: nativ shims Start's `router.entry` and route-tree wiring, so a build + boot check catches convention drift.

## Authoring Tier 1 primitives (shared UI package only)

When the human scoped the UI package — read existing primitives (`button`, `input`, `switch`, …) and match:

| Must | Detail |
| --- | --- |
| **File sections** | `TYPES` → `CLASSES` (`{COMPONENT}_{PART}_{ROLE}_CLASS`; `_SURFACE_`, `_LAYOUT_`, `_INTERACTION_` only) → `CONTEXT` + `useXxx()` → parts → root |
| **Neutral only** | Gray baseline in Tier 1 — no `hover:`, `focus-visible:`, `active:`, brand tokens |
| **Interaction** | `clickable` / `non-clickable` / `cursor-text` via disabled branch — never omit both |
| **Hook contract** | `useXxx()` returns `is*` fields (`isDisabled`, `isChecked`, `isOpen`, …) for Tier 2 paint |
| **Composition** | Named slots + document-order `{children}`; compound parts use matching `displayName` |
| **className** | One root `className`; route `placeholder:` / `caret:` to inner field when grouped |
| **Tier 2 (app)** | Inline brand `cn()` on each `App*.Part`; no child-scanning or `[&>…]` into Tier 1 internals |

**Scope of "neutral only":** it applies to **interactive Tier-1 primitives** (button, input, checkbox, switch). Full-screen, app-overridable **shell/guard fallbacks** (orientation guard, splash overlay) may use theme tokens (`bg-background`, `text-primary`) — they're not composable primitives.

## Drawer — controlled open

Keep drawer **mounted**; toggle `open` only. Do not `{open && <Drawer />}` — exit animation requires the root to stay in the tree. Use `onOpenChange` that accepts both `true` and `false`.

## Styling contract

- **Tier 1:** neutral baseline — no brand rings/padding in the library.
- **Tier 2:** brand at the call site.
- Focus rings (`ring` vs `border`) and press feedback (`active:scale-*`) follow `core/react-components` (co-loaded with this skill) — don't restate them here.

## Shell anti-patterns

| Mistake | Why it breaks |
|---------|----------------|
| Window/body scroll | Rubber-band; fights touch-action |
| `overflow-auto` without `min-h-0` parent | Zero-height scroll area |
| Unmount drawer when closed | Broken exit animation |
| Edit shared package CSS from app | Use app theme + `className` at call site |

## New screen checklist

1. Root bootstrap already in place (`nativ.config.ts` + `nativ()`).
2. Page root: a `Screen` (static full-screen surface — fills the shell, `inset` for safe-area) **or** a `ScrollView` (scrolling). Both own the `flex min-h-0 flex-1 flex-col` chain, so don't hand-roll it.
3. Scrolling content: `ScrollView` (subsumes `scrollable-y` + `min-h-0 flex-1`); pass `edgeFades` for masked safe-area edges.
4. Chrome: safe-area utilities on headers/footers.
5. Copy patterns from an existing frontend in the repo when adding a new app.
