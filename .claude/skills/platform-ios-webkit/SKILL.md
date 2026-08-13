---
name: platform-ios-webkit
description: Device-measured iOS, WebKit and standalone-PWA runtime behavior: text overlays that CSS cannot fix, the focus-scroll versus keyboard race, edge swipe-back, suppress-native-then-reimplement, and why the simulator lies. Use when debugging gesture, keyboard, scroll, magnifier, autocorrect, or installed-PWA behavior.
---

# iOS, WebKit and the standalone PWA

How the **target runtime** actually behaves — not how this repo is wired. Everything here is device-measured and stays true in any iOS-PWA codebase, so it survives a project copy. Read before debugging gesture, keyboard, scroll, or text-overlay behavior.

This repo's wiring for the same area lives in `stack-ui-shell` (shell/viewport) and `stack-gotchas` (ports, worktree, framework layer).

## Trust the device over the simulator

For gesture, keyboard, scroll, and text-overlay bugs: **the iOS Simulator lies.** Several WebKit behaviors only reproduce on real hardware. When the human reports something from their device, believe the repeated on-device report over one clean sim run.

**Instrument and reproduce on the real device before changing code** — don't guess-and-check. Capturing device logs without manual handoff: `stack-debugging`.

## iOS WebKit text overlays are not CSS-fixable

| Overlay | Reality | Only fix |
|---------|---------|----------|
| Autocorrect / spellcheck popover, selection handles, callout | Detach on scroll; **cannot** be moved or styled from web | Disable autocorrect/spellcheck statically on the field |
| Double-tap magnifier **loupe** | WebKit bug 231161; not CSS-controllable; **won't reproduce in sim** | JS `touchstart` patch (a `use-suppress-text-magnifier`-style hook) |
| Caret repaint glitch | The exception — fixable | App-wide caret repaint fix |

Don't burn time trying to reposition these with CSS. Pick the static-disable or JS-suppression path.

## Focus scroll races keyboard-avoidance (and ignores `scroll-behavior`)

Focusing a field triggers **two** scrolls: WebKit's own "reveal the focused element", which is always instant, and the app's keyboard-avoidance `scrollTo({ behavior: "smooth" })` two rAFs later. Which one you see is decided by **keyboard warm-up**:

| Focus | Keyboard commits | Scroll range when avoidance runs | Result |
|-------|------------------|----------------------------------|--------|
| First (cold keyboard) | ~130ms | **0** — the reservation hasn't landed, nothing can scroll yet | avoidance does the whole 200px → **smooth** (18 intermediate positions) |
| Every one after (warm) | ~2-3ms | already full | WebKit snapped there first → **instant**, avoidance has ~7px left to do |

So "smooth on the first focus, snappy after that" is **expected behavior, not a regression** — don't re-debug it.

**Confirmed by patching `scrollTo` and reading `scrollTop` synchronously inside the call**, so this is measured, not inferred:

| Focus | `scrollTop` when the avoidance `scrollTo` ran | Who moved it |
|-------|-----------------------------------------------|--------------|
| First | **0** — still at the origin | the app primitive, and it animated properly (19 frames) |
| Warm  | **200** — already at the destination | WebKit's native focus reveal got there first; the call is a no-op |

Same call, same `behavior: "smooth"`, opposite outcomes — the primitive animates fine whenever it actually has work. So there is **nothing to fix in the avoidance primitive**, and no web-facing lever: the native reveal is not suppressible for a user-initiated tap (`preventScroll` only applies to programmatic `focus()`).

Two details if you ever revisit: the primitive targeted `top: 207` on a scroller whose max is `200`, so on a warm focus it is doubly a no-op (already there, and the target clamps). And `scroll-behavior: smooth` on the scroller does **not** help — measured, no change; WebKit's reveal ignores it.

## Suppress-native-then-reimplement

Native mobile browser behaviors (keyboard pushing layout, overscroll/rubber-band) are **deliberately suppressed**, then reimplemented in-app. **Do not remove the suppression** thinking it's a bug — you'd reintroduce the native behavior the app intentionally replaced.

This is the general shape of a native-feel PWA: the platform default is removed on purpose, and an app-owned primitive stands in for it. Before "fixing" something that looks disabled, find the primitive that replaced it.

## Edge-swipe back vs scroll-lock

iOS edge swipe-back **cannot** be blocked by `preventDefault`. A drawer's scroll-lock *does* incidentally block it — so scope scroll-lock **to the drawer, never app-wide**, or you kill back-navigation.

## Standalone PWA has no URL bar

Installed/standalone mode has no browser chrome. **Every reachable page needs an in-app nav affordance** — you can't rely on the URL bar or a back button being visible. Verify layouts in a mobile browser **and** in standalone whenever you ship a manifest.

## Press feedback on iOS

CSS `:active` is unreliable on iOS. Prefer a JS-driven `data-pressed` attribute from a gesture engine (reentrant, and it fires where `:active` doesn't); fall back to `active:` only on raw elements not wired to the engine. Magnitudes and durations: `core-motion`.
