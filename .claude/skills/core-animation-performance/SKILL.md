---
name: core-animation-performance
description: Why an animation janks and how to make it buttery — the compositor-vs-layout rule, what transform/opacity buy you, will-change discipline, revealing to auto height without animating height, container-observer and anchored-sheet traps, and how to profile jank instead of guessing. Use when an animation feels laggy, janky, stuttery or not smooth, when animating height/expand/collapse, drawers, sheets, accordions or pickers, or when choosing between CSS, FLIP and a motion library.
---

# Animation performance

Buttery-smooth motion is one decision made right, repeatedly: **keep the animation on the compositor
thread, off the layout/paint path.** `core-motion` owns the *taste* (easing, duration, press feedback);
this owns *why it janks and how to make it smooth* — especially on the iOS/WebKit target.

## The one mental model

The browser renders `Style → Layout → Paint → Composite`. Where the animation lives decides smoothness:

- **`transform` + `opacity`** → **compositor thread (GPU)**, skip Layout and Paint. Smooth even when the main thread (React) is busy. Target for ~everything.
- **`width/height/top/left/margin`** → **full pipeline every frame** on the main thread. Miss the budget once (16.7ms @60Hz, **8.3ms @120Hz iPhone**) and you drop a frame — that's the lag.

The classic tell — *"my list's layout animation is gorgeous but the drawer/picker height animation is laggy"* — is not the device. The list uses FLIP (transform); the height animation runs Layout+Paint every frame. **Property choice, not GPU.**

## Decision — by what's changing

| Changing | Reach for |
|---|---|
| Move / fade / scale (enter, exit, press, slide) | CSS transition on **`transform` + `opacity`** |
| A real reflow must look smooth (reorder, resize) | **FLIP** — measure→invert→play with transforms (Motion `layout` prop) |
| Reveal to intrinsic height (drawer, accordion) | **grid `1fr↔0fr`**, or slide/clip a fixed-size layer via `transform`/`clip-path` — never animate `height` |
| Scroll-linked (progress, parallax, sticky-shrink) | **CSS scroll-driven animations** (`animation-timeline: scroll()/view()`), off main thread; `IntersectionObserver` fallback |
| Page / shared-element transition | **View Transitions API**; no-op fallback |
| Gesture / interruptible / velocity (drag, fling, swipe) | JS springs + **motion values** that bypass React render |
| Otherwise-unanimatable value (gradient stop, angle) | register with **`@property`**, then transition it |

## The hot rules

1. **Animate only `transform` and `opacity`.** Everything else is a fallback or a measured exception.
2. **Never animate `width/height/top/left/right/bottom/margin/padding`** — Layout every frame. The #1 cause of lag.
3. **To reveal to auto height, don't animate `height`.** Grid `1fr↔0fr`, or slide/clip a fixed-size layer. Don't fake it with `scaleY` — it squashes children unless you counter-scale them (what FLIP does for you).
4. **`will-change: transform` right before, remove right after.** Never in static CSS, never on many elements. It creates a **containing block that breaks descendant `position: fixed`**, can **grayscale/blur text**, and over-promotion blows GPU memory (tab-kill on iOS). Last resort for a *measured* problem.
5. **WebKit flicker/jitter** → `backface-visibility: hidden` + `translateZ(0)` on the animated element (the 3D transform forces a clean composited layer). `backface-visibility` alone does nothing on a 2D element.
6. **Don't animate `box-shadow` / `filter: blur` / `border-radius`.** Blur is the priciest paint. Put the shadow on a pseudo-element and animate *its* `opacity`. A `backdrop-filter` on a `position: fixed` element is scroll death on iOS — use `sticky`.
7. **Scroll:** passive listeners (`{ passive: true }`); never read layout in a scroll handler; prefer scroll-driven animations / `IntersectionObserver`; `overscroll-behavior: contain` on drawers (see `platform-ios-webkit` for the edge-swipe caveat).
8. **No layout thrashing:** batch all reads, then all writes. Never read geometry (`getBoundingClientRect`, `offsetHeight`, `getComputedStyle`) right after a write in a loop.
9. **React:** never drive per-frame animation through `setState` (re-render storm). Use refs + direct style writes, or a library's motion values.
10. **`requestAnimationFrame`, never `setInterval`;** derive motion from the rAF timestamp (delta-time) — a 120Hz screen runs a fixed-step animation twice as fast; pause on `visibilitychange`.
11. **`prefers-reduced-motion`:** replace large motion with a fade, keep essential feedback; use `.01ms` (not `0`) so JS `animationend`/`transitionend` still fire.
12. **Budget for the device:** 60Hz=16.7ms, 120Hz ProMotion=8.3ms. Safari caps rAF to 60fps unless the ProMotion flag is off.

## Height-reveal recipe (the drawer/picker/accordion trap)

Transitioning `height` open is *the* classic lag. In order of preference:

- **Slide/clip a fixed-size layer** — content has a known size; lay it out once and animate a wrapper's `transform: translateY()` or `clip-path`. Compositor-only, cheapest. Best for drawers, sheets, wheel pickers.
- **Grid `1fr↔0fr`** — wrap content in `display: grid`, animate `grid-template-rows: 0fr → 1fr`, child `overflow: hidden; min-height: 0`. True `auto` height, portable. Best for accordions.
- **`interpolate-size: allow-keywords` / `calc-size()`** — real `height: auto` transitions, but **Chromium-only** — layer *on top of* the grid fallback via `@supports`, never alone.

## Revealing inside a sheet, drawer, or observed container

Two costs that don't exist on a plain page — either will make a size animation that profiled fine in isolation feel awful in place:

- **Container observers.** Sheets/drawers/virtualized panes commonly put a `ResizeObserver` on their content to re-measure themselves. Animating a child's **size** fires it every frame, and those callbacks almost always read geometry (`getBoundingClientRect`) → **forced synchronous layout every frame**, on top of the animation. Symptom: smooth in a standalone repro, janky in the app. **Profile in situ, never in isolation** — and suspect this first when the two disagree.
- **Anchoring turns local growth into global motion.** In a bottom-anchored surface, expanding something near the bottom translates *everything above it* by the revealed height. Add the revealed content's own fade and that's two simultaneous motions; people read it as parallax or "dizziness" **even at a solid frame rate**. A choreography bug, not a performance one — no amount of GPU work fixes it.

**The move:** snap the footprint (grid `0fr↔1fr` with no transition keeps the natural height) and animate only the content with `transform`/`opacity`. If the surface must not move at all, float the content as an overlay so nothing reflows. Repo specifics: `stack-ui-shell`.

## iOS / WebKit (the target — assume the Simulator lies)

- **`position: fixed` acting like `absolute`:** an ancestor with `transform`/`filter`/`will-change`/`contain`/`content-visibility` became its containing block. Remove it, hoist the fixed element out, or use `sticky`.
- **Viewport:** `100vh` overflows on iOS — use `svh`/`lvh`/`dvh` (`dvh` reflows as the toolbar slides). See `platform-ios-webkit` and `stack-ui-shell`.
- **Layer budget:** too many/too-large composited layers → GPU-memory blowout, tab kill (canvas ~224MB cap; ~2–3GB page). Promote sparingly, demote when idle.
- The full device bug catalog (text overlays, magnifier, focus-scroll races, suppress-native) lives in `platform-ios-webkit` — read it before debugging any device-only motion bug.

## Measure — don't guess

Capture a profile, classify the bottleneck, apply the matching fix:

- **Chrome:** Rendering tab → Paint Flashing (green = repaint), Layer borders, Frame Rendering Stats; Performance → "Forced Reflow" insight; Layers panel → Compositing Reasons + memory.
- **Safari (what iOS users run):** Web Inspector → Timelines → **Frames view** — each bar's height is its render time; bars over 16.667ms are dropped frames, split into Script / Layout / Paint.
- **Production:** Long Animation Frames API (`forcedStyleAndLayoutDuration` = thrash); INP (high presentation delay = layout/paint-bound frame).

| Profile shows | Bound | Fix |
|---|---|---|
| Purple Layout / red forced reflow | Layout | stop animating layout props; batch reads-then-writes |
| Green Paint / whole-area paint flash | Paint | reduce paint area; shadow→pseudo-element opacity; don't animate blur |
| Main thread fine but stutters; many layers | Composite | cut layer count; `transform`/`opacity` only; drop needless `will-change` |
| Long JS blocks | Script | move off `setState`; refs/motion values; passive listeners |

## Pairs with

`core-motion` (easing/duration/press-feedback taste) · `platform-ios-webkit` (device traps) ·
`stack-ui-shell` (drawer, viewport, safe-area) · `core-react-components` (component patterns).
