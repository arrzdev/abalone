---
name: core-react-components
description: React component doctrine: props contracts, no ternaries in JSX, data-* styling hooks, when to split a component, where the logic lives, useEffect as last resort, and accessibility. Use when writing or reviewing any .tsx component or UI hook.
---

# React components

**Scope:** repo-agnostic React patterns. Do not assume package names — read the project's conventions first.

## Props contract

### Naming and placement

```ts
// ✅ Named type, exported when callers need it
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary"
  isLoading?: boolean
}
```

- Name: `ComponentNameProps`; define next to the component.
- Extend the native element's attributes so `id`, `aria-*`, events, `className` stay typed.
- `Omit` native props you replace with a clearer name (`onChange` → `onCheckedChange`).

### JSDoc — when to document

Per-prop JSDoc when any apply: purpose, default, units/constraints, callback timing, a11y note.

### JSDoc — styling hooks (shared UI libraries)

When the component ships in a shared library, callers style programmatic state via `data-[…]:` selectors. The component JSDoc **must** list every `data-*` the component sets, which DOM node carries it, and example selectors.

```tsx
/**
 * Toggle switch.
 *
 * **Styling hooks** — pass `className` to the root button:
 *
 * | Attribute | When | Example |
 * |-----------|------|---------|
 * | `data-checked` | `true` when on | `data-[checked=true]:bg-brand` |
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(…)
```

Keep the table in sync with implementation — new state → new `data-*` + new row in JSDoc in the same PR.

## Conditional rendering in JSX

Do **not** use ternaries for UI branches. Prefer `&&` for optional output and paired `&&` lines for if/else.

```tsx
// ❌ optional branch via ternary
{center.length > 0 ? (
  <span className="inline-flex …">{center}</span>
) : null}

// ✅ optional branch
{center.length > 0 && (
  <span className="inline-flex …">{center}</span>
)}

// ❌ if/else via ternary
{showPassword ? <EyeOff /> : <Eye />}

// ✅ paired guards
{showPassword && <EyeOff />}
{!showPassword && <Eye />}
```

**Rules**

- Never `{condition ? <Node /> : null}` — use `{condition && <Node />}`.
- For two UI branches, use two expressions: `{condition && …}` and `{!condition && …}`.
- Ternaries are fine **outside JSX** (variables, props, `className` slices in `cn()`, hooks).

## Flat control flow

Handle invalid/disabled/edge cases **first** with early returns. Keep the happy path flat.

```ts
// ✅ guard clauses
function handleToggle() {
  if (disabled) return
  if (isOpen) return closeMenu()
  openMenu()
}
```

## `data-*` state hooks (shared UI libraries)

Mirror programmatic state on the owning DOM node with a `data-{name}` attribute.

```tsx
<button
  data-checked={checked}
  data-indeterminate={indeterminate}
  className={cn(
    "group rounded border transition-colors",
    "data-[checked=true]:border-primary data-[checked=true]:bg-primary",
    className,
  )}
>
```

| State | Attribute | Consumer selector |
|-------|-----------|-------------------|
| Toggle on | `data-checked={checked}` | `data-[checked=true]:bg-primary` |
| Open | `data-open={isOpen}` | `data-[open=true]:opacity-100` |
| Selected | `data-selected={isSelected}` | `data-[selected=true]:font-medium` |

**Do not use `data-*` for a11y** — keep `aria-*`, `role`, native attributes alongside but separate. `data-*` is the *styling* contract only.

**Consumers must never use `data-*` (or any internal) to override a component's *behavior*.** When you need to change how a component works, **expand its public interface** (a prop, a slot) — never patch via internals, especially when the package is your own. Reaching into internals is a smell that the interface is too small (see `core-repository-layout`).

## Styling — Tailwind + `cn()`

### `border` vs `ring` (avoid layout shift)

`border` is in the box model — adding or thickening it on hover/focus states **shifts layout**. `ring` draws outside the element and does not change size.

| Situation | Use |
|-----------|-----|
| Shell **always** has a visible border | `border` + change **color** on focus/hover — width stays constant |
| **No** border by default; outline only on focus/hover | `ring` |
| State would **add** border width where there was none | `ring`, not `border-2` |

```tsx
// ✅ ring — no size change
"border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// ✅ always-bordered field — recolor border
"border border-border enabled:hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
```

### `:active` / `active:` (shared library defaults)

**Almost never ship `active:` in default `className` unless the human asked.** The only permitted press styling is **`active:scale-*`** with **`origin-center`**, instant press (`active:duration-0`), and spring-ish release (~200ms). No `active:bg-*`, `active:opacity-*`.

One `cn()` call: defaults + conditional slices + caller `className` last.

```tsx
className={cn(
  "rounded-md border border-primary bg-primary text-white transition-colors duration-200",
  disabled && "cursor-not-allowed opacity-50",
  isLoading && "bg-primary/80",
  className,
)}
```

## When to split a component

Extract a child only when it earns a **name** *and* at least one **trigger**. Length alone is never a trigger.

Triggers (any one):

- **Repeated** — rendered in a `.map()` (a list item).
- **Owns state/effects** the parent doesn't care about, or needs its own re-render boundary.
- **Mounts/unmounts as a unit** (its own conditional).
- **Reused** in 2+ places.

If none apply, **leave it inline** — even if long; use a `//---- section ----` banner instead of a premature component. Decide at write-time and only re-split when a *new* trigger appears — don't re-split on polish.

## Logic placement — own the action where it lives

Splitting (above) is about *structure*; this is about *where logic lives*.

A self-contained action — a create/edit/delete drawer, a confirm flow — should be a **smart component** that owns its mutation + error + close. The parent passes only the state it genuinely **orchestrates** (open/close, which item) and reacts to outcomes via a thin callback (`onCreated`). Lifting an action's mechanics into the parent *when it isn't orchestrating* only bloats the page and makes it unreadable.

- **Dumb form + smart wrapper:** keep the form presentational (controlled inputs, `onSubmit`); wrap it in a smart component that runs the mutation (`CreateItemDrawer` → `ItemFormDrawer`). The page renders `<CreateItemDrawer open=… />`, not the form plus a handler.
- Parent orchestration *is* right when it coordinates shared state the action touches (the filter a new item should appear under, confetti on the last completion) — pass a thin callback for **that**, not the whole action.

## Compound components (flexible APIs via Context)

Use when children share state, accessibility mandates structure, or children need context from the parent.

```tsx
const TabsContext = createContext<{ activeTab: string; setActiveTab: (t: string) => void } | null>(null)

export function Tabs({ children, defaultTab }: { children: React.ReactNode; defaultTab: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const value = useMemo(() => ({ activeTab, setActiveTab }), [activeTab])
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}
```

Memoize context values with `useMemo` to prevent excess re-renders.

## `useEffect` — last resort

`useEffect` is for syncing with **external systems**: browser APIs, subscriptions, third-party imperative DOM.

| Scenario | Prefer instead |
|----------|---------------|
| Derived / computed values | Compute during render; `useMemo` only if profiling shows cost |
| Reset state when id changes | `key={id}` on the component so React remounts |
| Notify parent when state changes | Call parent callback in the **event handler**, not an effect |
| Server data | TanStack Query / route loaders |

**Exception — kept-mounted forms.** A drawer/modal that stays mounted (per `stack-ui-shell`, exit animations need it) can't use the `key={id}` remedy. Re-seeding its form `useState` from props on the `open` transition via `useEffect` is the sanctioned pattern there.

## Accessibility

Default to **full accessibility**, not an afterthought:

- **Native elements first** (`<button>`, `<a>`, `<label htmlFor>`); add `role` only when no native element fits.
- **Correct `aria-*` for state** (`aria-checked`, `aria-expanded`, `aria-invalid`, `aria-selected`) — separate from `data-*` (styling).
- **Keyboard:** every interactive element reachable + operable; visible `focus-visible` ring; Escape/arrow keys where the pattern expects them; focus trap + restore for modals/drawers.
- **Live regions** for async/status updates that aren't visually obvious.

## Checklist

- [ ] `ComponentNameProps` type exported; extends native element attributes
- [ ] JSDoc on non-obvious props: purpose, default, callback semantics
- [ ] **Shared library:** component JSDoc lists `data-*` hooks, target element, example selectors
- [ ] Guard clauses at top; happy path flat
- [ ] JSX: `&&` for optional UI; paired `&&` for if/else — no `? : null` or element ternaries
- [ ] Programmatic visual state exposed as `data-{name}` on the owning element (shared library)
- [ ] One `cn()` call: defaults + conditional slices + caller `className` last
- [ ] Focus/hover outlines: `ring` when no default border; `border` only when width is always present
- [ ] `disabled` attribute on controls + `disabled:` / `enabled:` utilities
- [ ] Compound components used when children share state
- [ ] No `useEffect` for derived values, prop resets, or parent notifications
