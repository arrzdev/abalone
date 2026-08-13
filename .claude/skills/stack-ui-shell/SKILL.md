---
name: stack-ui-shell
description: The three-tier UI pattern over @repo/nativ, the non-scrolling viewport contract, safe-area utilities, drawer rules, the nativ.config bootstrap, and which input hooks exist. Use when building a screen, layout, drawer, or any components/ui wrapper.
---

# UI shell and shared UI consumption

The shared UI package here is **`@repo/nativ`** (`@repo/nativ/components`, `/hooks`, `/utils`, `/shell`, `/styles.css`). Do not author it during app feature work unless the human scoped the package.

## Non-negotiables

1. **Prefer the shared package** — check its exports before rolling your own button, drawer, input, etc.
2. **Never edit `@repo/nativ`** from app work — report the missing capability; ask.
3. **Customize at the call site** — `className`, composition slots, props.
4. **App-local wrappers OK** — thin files that import the base component and add brand-only classes.

## Three-tier UI pattern

```
feature routes
  → app components/ui          (Tier 2 — branded wrappers)
    → @repo/nativ/components   (Tier 1 — behavior, a11y, neutral baseline)
```

| Tier | Where | Rule |
|------|-------|------|
| **3** | App features | Import from app `components/ui` — never the shared package directly |
| **2** | `components/ui/*.tsx` | Wrap Tier 1 with brand `className` via `cn()`; type props as `ComponentPropsWithRef<typeof BaseX>` |
| **1** | Shared UI package (`@repo/nativ`) | Behavior + neutral gray baseline; edit only when the human scopes the package |

**Tier 2 naming: name by role, prefix only to avoid a collision with the base export.** In this repo that's `PrimaryButton`, `SecondaryButton`, `GhostButton`, `IconButton`, `TextInput`, `TextArea`, `Checkbox`, `Switch`, `HoldToConfirmButton` — plus `AppDrawer` and `AppSwipeable`, which carry the `App` prefix because the base shares the name. Don't blanket-prefix a new wrapper; don't shadow a base name without a prefix.

`components/ui/index.ts` is the app's design-system barrel and **is** the sanctioned entry (`core-repository-layout`) — use it consistently rather than mixing barrel and deep imports.

**Compound wrappers:** export `AppRoot` + `AppRoot.Part` via `Object.assign`; each part renders the base part with brand classes and a **matching `displayName`** (`"Drawer.Overlay"`, `"Button.Text"`) — the same string the Tier-1 part uses.

That `displayName` is a contract, not a debug label: wrappers detect compound-slot usage by scanning children for those exact strings (see `PrimaryButton`, which wraps bare children in `Button.Text` only when no slot is present). A wrong or missing `displayName` silently changes rendering.

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

When the human scoped the UI package — read existing primitives and match:

| Must | Detail |
| --- | --- |
| **File sections** | `TYPES` → `CLASSES` (`{COMPONENT}_{PART}_{ROLE}_CLASS`) → `CONTEXT` + `useXxx()` → parts → root |
| **Neutral only** | Gray baseline in Tier 1 — no `hover:`, `focus-visible:`, `active:`, brand tokens |
| **Interaction** | `clickable` / `non-clickable` / `cursor-text` via disabled branch — never omit both |
| **Hook contract** | `useXxx()` returns `is*` fields (`isDisabled`, `isChecked`, `isOpen`, …) for Tier 2 paint |
| **Composition** | Named slots + document-order `{children}`; compound parts use matching `displayName` |
| **className** | One root `className`; route `placeholder:` / `caret:` to inner field when grouped |
| **Tier 2 (app)** | Inline brand `cn()` on each `App*.Part`; no child-scanning or `[&>…]` into Tier 1 internals |

**Scope of "neutral only":** it applies to **interactive Tier-1 primitives** (button, input, checkbox, switch). Full-screen, app-overridable **shell/guard fallbacks** (orientation guard, splash overlay) may use theme tokens (`bg-background`, `text-primary`) — they're not composable primitives.

## Drawer — controlled open

Keep drawer **mounted**; toggle `open` only. Do not `{open && <Drawer />}` — exit animation requires the root to stay in the tree. Use `onOpenChange` that accepts both `true` and `false`.

Because it stays mounted, `key={id}` can't reset a form inside it — re-seed form `useState` from props on the `open` transition via `useEffect` (`core-input-handling`, `core-react-components`).

## Don't animate a child's size inside the drawer

Two traps, both measured on device (the due-date wheel picker):

- **The drawer observes its own content.** `drawer-engine` puts a `ResizeObserver` on the content box, and `drawer.tsx` another on the scroller for the edge fades. Animating a child's **height/size** fires them **every frame**, and each callback runs `getBoundingClientRect()` on panel + content — a forced synchronous layout per frame — plus a React state write. **A standalone page cannot reproduce this**: the identical animation is smooth in mobile Safari outside the drawer, so profile it *in the app*.
- **The sheet is bottom-anchored, so inline growth moves everything above it.** Expanding a field near the bottom shifts the whole form by the revealed height; together with the content's own fade that's two simultaneous motions and reads as parallax **even at a good frame rate** — a choreography problem, not a performance one.

**Do:** snap the footprint — grid `0fr↔1fr` with *no* transition still gives the content's natural height, no magic pixel constant — and animate only the revealed content with `transform`/`opacity`. If nothing may move at all, float it as an overlay so there is no reflow. Doctrine: `core-animation-performance`.

## Input hooks available in this app

`core-input-handling` is the doctrine; this is what's actually wired here.

| Need | Here |
|---|---|
| Submit + error + pending | `use-data-mutation` (`stack-frontend-data`) |
| Local persisted UI state | `use-persistent-state` |
| Debounce | **not present** — write the local hook (`src/hooks/use-debounce.ts`) to the signature `core-input-handling` Pattern 3 assumes |
| URL / shareable state | **not wired** — `nuqs` is not a dependency. Adding it is a new-dep decision (ask first); TanStack Router's own search-param APIs are already in the tree |

Neither absence is a reason to skip the doctrine — keep the rule (URL is the source of truth, debounce straight to the final action) and adapt the API.

## Styling contract

- **Tier 1:** neutral baseline — no brand rings/padding in the library.
- **Tier 2:** brand at the call site.
- Focus rings (`ring` vs `border`) and press feedback (`active:scale-*`) follow `core-react-components` (co-loaded with this skill) — don't restate them here.

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
