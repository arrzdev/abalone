---
name: core-ui-quality-gate
description: The pre-PR checklist every UI change must pass — no layout shift on click, open, hover, load or font swap; space reserved for text that appears later; no hard-clipped or occluded text; modals that never scroll; focus rings and touch targets; empty, loading and error states; tested at 375x667, 402x710 and desktop in Chromium and WebKit; and no generic UI slop. Use before opening or reviewing any PR that touches a .tsx component, CSS, a modal, dialog, drawer, form, status or error message, or when asked about layout shift, CLS, jumping UI, clipped, cut-off, truncated or overflowing text, or UI polish.
---

# UI quality gate

Run this on **every** UI change before the PR opens, and again in review. Each item is a regression that has already shipped to production at least once. "It looks fine on my viewport" is not a pass; a pass is a test or a screenshot at every size below.

The checklist is the rule. The automated checks that enforce it in this repo are in `stack-testing-setup` → "UI quality checks".

## The checklist

Copy it into the PR description and tick each line, or write why it does not apply.

```
UI quality gate
- [ ] No layout shift: click, open, hover, focus, loading → loaded, font swap
- [ ] Space reserved for text that appears later (status, error, feedback)
- [ ] No hard-clipped text: ellipsis or wrap, never cut mid-character
- [ ] No text hidden by its container, the viewport, or a sticky bar
- [ ] Modals and dialogs fit without scrolling at 375x667
- [ ] Focus ring fully visible on every control (not cut by overflow)
- [ ] Touch targets ≥ 44x44 on phone
- [ ] Empty, loading and error states exist and look designed
- [ ] Checked at 375x667, 402x710 and desktop, Chromium + WebKit
- [ ] New UI spec uses the shift and clipped-text helpers
```

## 1. Layout shift — nothing moves that the user did not move

A shift is any element changing position or size as a side effect. The web.dev metric ignores shifts within 500 ms of input; **this gate does not** — a modal that grows when you press "Copy" is a bug even if CLS reads 0.

| Trigger | Typical cause | Fix |
|---|---|---|
| Click / submit | feedback line rendered only after the action | render the line from the start, empty, with its final height |
| Open (modal, drawer, menu) | content measured after mount, async data | fixed or `min-height` box; skeleton that matches the final shape exactly |
| Hover / focus / selected | border or font-weight added on state | reserve it: transparent border, `outline`, or a `box-shadow` ring |
| Loading → loaded | spinner smaller than the content it replaces | skeleton or fixed box with the loaded size |
| Loading button | label swapped for a spinner, width changes | keep the label, overlay or append the indicator in reserved space |
| Font swap | fallback metrics differ from the web font | matched fallback (`size-adjust`), preload, or `font-display: optional` |
| Images, canvas, embeds | no intrinsic size | `width`/`height` or `aspect-ratio` |
| Animation | animating `top`, `height`, `margin` | `transform` / `opacity` only — see `core-animation-performance` |
| Scrollbar appears | content grows past the viewport | `scrollbar-gutter: stable` on scrollers |

**Reserve, don't insert.** Any text that can appear later (status, validation error, "Link copied", "Saving…", count) owns its slot from first render: `min-height` of one line, or render the element with `visibility: hidden` / empty content. Swap the text, never the box.

## 2. Text is never clipped or hidden

- **One-line values** (URLs, names, codes): `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, and keep the full value reachable (copy button, `title`, selectable input). Cut mid-character with no ellipsis is always a bug.
- **Prose and copy**: wraps. No fixed `height` on a text box; use `min-height`.
- **Containers**: no text box may extend past its scroll container or the dialog's visible rect. Check `scrollWidth > clientWidth` on anything without ellipsis.
- **Long content**: try the longest real string (longest locale, a 30-character username, a long URL), not the placeholder.
- **Sticky headers, footers, the keyboard and the safe area** never cover text or the focused control (WCAG 2.4.11).

## 3. Modals never scroll

A modal or dialog shows all its content at 375x667 without an inner scroll. If it does not fit, the design is wrong: cut content, split the step, or use a full screen page. The page behind it never scrolls either (`overscroll-behavior: contain` on the overlay).

## 4. Focus and touch

- Every focusable element shows a `:focus-visible` ring that is **fully** visible: not cut by a parent `overflow: hidden`, not under a sibling. Leave room with padding on the clipping parent, or use an inset ring.
- A mouse click draws no ring.
- Touch targets ≥ 44x44 on phone (24x24 minimum on desktop). Grow the hit box with padding, keep the look.
- Inputs use ≥ 16px text on mobile, or iOS zooms on focus.

## 5. Every state is designed

For each data-driven view: **empty** (says what to do next), **loading** (same shape as loaded), **error** (says what happened and what to do — see `core-copywriting`), **long/dense** (many items, long strings). A view with only the happy path is not done.

## 6. Test matrix

| Viewport | Why |
|---|---|
| 375x667 | smallest phone in use; modals and bottom bars break here first |
| 402x710 | real iPhone Safari visible area (the page sits under the status bar and toolbar) |
| desktop (1280x800 or larger) | wide layouts, hover states |

Each in **Chromium and WebKit**. WebKit catches font metrics, `:active`, safe-area and scroll behavior that Chromium hides — see `platform-ios-webkit`.

## 7. No UI slop

Generic UI reads as unfinished even when it works. Before review, check:

- Every choice is a choice: spacing on the scale, type from the project's set, colors from tokens. No one-off `13px`, no random shadow.
- No default kit: identical rounded cards with soft shadows, gradient filler, an all-caps label over everything, fade-up on every section.
- One bold element per screen; everything around it is quiet.
- Motion answers an action (open, confirm, move) and nothing else — see `core-motion`.
- Copy is short and specific — see `core-copywriting`.
- Edges align, gaps are equal, nothing touches the screen edge without intent.

## In review

The reviewer runs the same checklist. A UI PR without the ticked checklist, or a new UI spec without the shift and clipped-text checks, goes back with "UI quality gate missing" — before any other comment.
