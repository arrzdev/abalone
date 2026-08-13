---
name: motion
description: >-
  Animation decisions, easing, duration, press feedback active:scale only, performance.
  Load when adding CSS/JS animation, transitions, motion, or UI polish.
---

# Motion and polish

## Should this animate?

| Frequency | Decision |
|-----------|----------|
| 100+ times/day | **No animation** |
| Tens/day (hover, list nav) | Remove or reduce |
| Occasional (modals, drawers) | Standard animation |
| Rare (onboarding) | Delight OK |

Never animate keyboard-initiated actions.

## Easing

- Enter/exit → **ease-out**
- Move/morph on screen → ease-in-out
- Hover/color → ease
- **Never ease-in** for UI (starts slow)

Custom curves when polish matters: `cubic-bezier(0.23, 1, 0.32, 1)` for ease-out.

## Duration

| Element | Duration |
|---------|----------|
| Press-scale release | ~160–220ms; press-in `0ms` |
| Tooltips, small popovers | 125–200ms |
| Dropdowns | 150–250ms |
| Modals, drawers | 200–500ms |

UI animations under **300ms** when possible.

## Press feedback — scale, and only where it belongs

Scale-only (no `active:bg-*` / `active:opacity-*`). Press-scale answers one question — *"am I physically pushing this?"* — so it belongs **only to tap-to-commit controls** (buttons, icon buttons, chips). It does **not** go on:

- **Containers / cards / list rows** — even *selectable* ones. Feedback is a **state change** (selected tint, checkmark), not a squeeze: a full-width card at `scale-[0.96]` moves each edge ~7px and reads as a crush.
- **Drag / sort / swipe items** — feedback is a **lift on drag-*start*** (elevation / shadow + a slight scale-**up**, raised z-index), never a press-down squeeze (Apple "lift", Material "picked-up").

Magnitude — fixed tiers; edge travel ≈ `size × (1 − scale) / 2`, so the bigger the element the closer to 1.0 it stays. **Floor 0.95** (below reads cartoonish):

| Tier | Elements | Scale |
|------|----------|-------|
| Small | Icon buttons, chips (≤~48px) | **0.95** |
| Standard | Text buttons | **0.98** |
| Surface | Cards, rows, sheets, full-width | **none** — use a state change |

```html
class="origin-center transition-transform duration-200 ease-out pressed:duration-0 pressed:scale-[0.98]"
```

- Prefer **`pressed:`** (JS `data-pressed` from the gesture engine — reentrant, and more reliable than CSS `:active` on iOS). Use `active:` only on raw elements not wired to the engine.
- Press-in **instant** (`duration-0`); release ~200ms ease-out.
- `origin-center` always. Respect `prefers-reduced-motion`.

## Key rules

- Never animate from `scale(0)` — start `scale(0.95)` + `opacity: 0`
- Popovers: scale from trigger (`transform-origin` from library CSS vars); modals from center
- Only animate `transform` and `opacity` for performance
- Avoid `transition: all` — list properties explicitly
- Exit faster than enter when asymmetric feels right

## Review checklist

| Issue | Fix |
|-------|-----|
| Press-scale on a card / row / container | Remove; use selected/hover state |
| Press-scale on a drag / sort item | Remove; lift on drag-start instead |
| Scale below 0.95, or a large surface scaling | Raise to tier value / drop to none |
| `active:bg-*` etc. | Remove; use scale only |
| Press without `origin-center` | Add it |
| `ease-in` on UI | Switch to ease-out |
| Duration > 300ms on frequent UI | Reduce |
| Framer `x`/`y` under load | Use `transform: translateX()` |
