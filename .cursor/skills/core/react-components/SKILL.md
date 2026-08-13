---
name: react-components
description: >-
  React component patterns: ComponentNameProps types, JSDoc data-* styling hooks,
  flat control flow, data-* state on DOM, cn() conditional Tailwind slices,
  compound components via Context, custom hooks, simple-to-complex composition,
  ring vs border for focus/hover (no layout shift).
  Load when writing components, hooks, forms, or design system primitives.
---

# React components

**Scope:** repo-agnostic React patterns. Do not assume package names — read the project's conventions first.

---

## Props contract

### Naming and placement

```ts
// ✅ Named type, exported when callers need it
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
}
```

- Name: `ComponentNameProps`; define next to the component.
- Extend the native element's attributes so `id`, `aria-*`, events, `className` stay typed.
- `Omit` native props you replace with a clearer name (`onChange` → `onCheckedChange`).

### JSDoc — when to document

Per-prop JSDoc when any apply: purpose, default, units/constraints, callback timing, a11y note.

```ts
type SheetProps = {
  /** Controls panel open state */
  open: boolean;
  /** Called when the panel should close */
  onOpenChange?: (open: boolean) => void;
  /** Allow dismissing by overlay click or Escape (default: true) */
  dismissible?: boolean;
};
```

### JSDoc — styling hooks (shared UI libraries)

When the component ships in a shared library, callers style programmatic state via `data-[…]:` selectors. The component JSDoc **must** list every `data-*` the component sets, which DOM node carries it, and example selectors.

```tsx
/**
 * Toggle switch. Renders `<button role="switch">` with `group` for the thumb.
 *
 * **Styling hooks** — pass `className` to the root button:
 *
 * | Attribute | When | Example |
 * |-----------|------|---------|
 * | `data-checked` | `true` when on | `data-[checked=true]:bg-brand` |
 * | `data-indeterminate` | `true` when mixed | `data-[indeterminate=true]:bg-muted` |
 *
 * Thumb: use `group-data-[checked=true]:translate-x-…` on the root's group.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(…);
```

Keep the table in sync with implementation — new state → new `data-*` + new row in JSDoc in the same PR.

---

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

// ✅ paired guards (same idea as guard clauses in handlers)
{showPassword && <EyeOff />}
{!showPassword && <Eye />}

// ✅ one branch = one block when icon + label move together
{copied && (
  <>
    <Check className="h-4 w-4 shrink-0" />
    Copied
  </>
)}
{!copied && (
  <>
    <Copy className="h-4 w-4 shrink-0" />
    Copy API key
  </>
)}
```

**Rules**

- Never `{condition ? <Node /> : null}` — use `{condition && <Node />}`.
- For two UI branches, use two expressions: `{condition && …}` and `{!condition && …}` (or an explicit inverse, e.g. `{center.length <= 0 && …}`).
- Keep everything that belongs to the same branch inside **one** `&&` block (fragment if multiple siblings). Do not split icon and label into separate `&&` lines.
- Ternaries are still fine **outside JSX** (variables, props, `className` slices in `cn()`, hooks) when they are not element-vs-null or element-vs-element choices.

---

## Flat control flow

Handle invalid/disabled/edge cases **first** with early returns. Keep the happy path flat.

```ts
// ❌ wraps happy path
function handleToggle() {
  if (!disabled) {
    if (isOpen) closeMenu();
    else openMenu();
  }
}

// ✅ guard clauses
function handleToggle() {
  if (disabled) return;
  if (isOpen) return closeMenu();
  openMenu();
}
```

`return fn()` is valid when `fn` is `void` and the branch has no other statements.

---

## `data-*` state hooks (shared UI libraries)

When a component has programmatic state that affects appearance, mirror that state on the owning DOM node with a `data-{name}` attribute. App code targets these for customization — it cannot see React state.

```tsx
<button
  type="button"
  role="switch"
  data-checked={checked}
  data-indeterminate={indeterminate}
  className={cn(
    "group rounded border transition-colors",
    "data-[checked=true]:border-primary data-[checked=true]:bg-primary",
    "data-[indeterminate=true]:bg-muted",
    className, // caller can add data-[checked=true]:hover:bg-primary-dark
  )}
>
  <span className="block translate-x-0 group-data-[checked=true]:translate-x-5 transition-transform" />
</button>
```

| State | Attribute | Consumer selector |
|-------|-----------|-------------------|
| Toggle on | `data-checked={checked}` | `data-[checked=true]:bg-primary` |
| Open | `data-open={isOpen}` | `data-[open=true]:opacity-100` |
| List focus | `data-focused={isFocused}` (roving index; focus stays on trigger) | `data-[focused=true]:bg-muted` |
| Selected | `data-selected={isSelected}` | `data-[selected=true]:font-medium` |
| Variant | `data-variant={variant}` | `data-[variant=secondary]:…` |

**Do not use `data-*` for a11y** — keep `aria-*`, `role`, native attributes (`disabled`, `aria-checked`) alongside but separate. `data-*` is the styling contract for apps and themes.

**Consumers must never use `data-*` (or any internal) to override a component's *behavior*.** When you need to change how a component works, **expand its public interface** (a prop, a slot) — never patch via internals, especially when the package is your own. Reaching into internals is a smell that the interface is too small (see `core/repository-layout`).

**When not required:** stateless presentation-only wrappers; state fully covered by native selectors consumers already have (`:disabled`, `[aria-invalid=true]`).

---

## Styling — Tailwind + `cn()`

### `border` vs `ring` (avoid layout shift)

`border` is in the box model — adding or thickening it on `:hover`, `:focus-visible`, `:focus-within`, or `data-*` states **shifts layout**. `ring` draws outside the element and does not change size.

| Situation | Use |
|-----------|-----|
| Shell **always** has a visible border | `border` + change **color** on focus/hover (`focus-visible:border-primary`, `enabled:hover:border-border-strong`) — width stays constant |
| **No** border by default; outline only on focus/hover | `ring` — e.g. `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (optionally `ring-offset-*`) |
| State would **add** border width where there was none | `ring`, not `border` / `border-2` |

```tsx
// ❌ layout shift — border appears on focus when default is borderless
"border-0 focus-visible:border-2 focus-visible:border-primary"

// ✅ ring — no size change
"border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

// ✅ always-bordered field — recolor border; ring is optional extra emphasis
"border border-border enabled:hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
```

**Keep `border` for:** persistent field chrome, dividers (`border-t`), selected-tab indicators (`border-b-2`), and any edge that is always the same width.

**Prefer `ring` for:** focus rings, hover outlines on borderless controls (buttons with `border-0`, icon hits, cards that only highlight on interaction).

### `:active` / `active:` (shared library defaults)

**Almost never ship `active:` in default `className` unless the human asked.** The only permitted press styling is **`active:scale-*`** with **`origin-center`**, tier-appropriate scale (micro 0.92–0.94 / standard 0.95–0.96 / macro 0.97–0.98), instant press (`active:duration-0`), and spring-ish release on `transform` (~200ms). No `active:bg-*`, `active:opacity-*`, or other press color/opacity changes.

One `cn()` call: defaults + conditional slices + caller `className` last.

```tsx
className={cn(
  "rounded-md border border-primary bg-primary text-white transition-colors duration-200",
  disabled && "cursor-not-allowed opacity-50",
  isLoading && "bg-primary/80",
  className,
)}
```

On native controls, keep the `disabled` attribute for behavior/a11y and paint with `disabled:` / `enabled:`:

```tsx
<button
  disabled={disabled}
  className={cn(
    "px-4 py-2 font-medium transition-colors",
    "bg-blue-600 text-white",
    "origin-center transition-transform duration-200 ease-out active:duration-0 active:scale-95",
    "enabled:hover:bg-blue-700",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  )}
>
```

**Default library styles must use `data-[…]:` selectors** (not only internal `cn()` branches) so consumers' `className` overrides compose predictably.

---

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
const TabsContext = createContext<{ activeTab: string; setActiveTab: (t: string) => void } | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs>");
  return ctx;
}

export function Tabs({ children, defaultTab }: { children: React.ReactNode; defaultTab: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const value = useMemo(() => ({ activeTab, setActiveTab }), [activeTab]);
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

function Tab({ value, children }: { value: string; children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useTabsContext();
  return (
    <button
      role="tab"
      aria-selected={activeTab === value}
      onClick={() => setActiveTab(value)}
      data-selected={activeTab === value}
      className={cn("px-4 py-2", "data-[selected=true]:border-b-2 data-[selected=true]:border-primary")}
    >
      {children}
    </button>
  );
}

Tabs.Tab = Tab;
```

Memoize context values with `useMemo` to prevent excess re-renders.

---

## Simple-to-complex composition (optional addons)

When children are optional and independent (icons, validation text), a single component can render primitive by default and compose when children are present — without forcing a Root/Field wrapper.

```tsx
const Input = React.forwardRef(({ children, ...props }, ref) => {
  if (!children) return <input ref={ref} {...props} />;

  const childArray = React.Children.toArray(children);
  const left = childArray.filter(c => (c as React.ReactElement).type === Input.Addon && (c as React.ReactElement).props.position === "left");
  const right = childArray.filter(c => (c as React.ReactElement).type === Input.Addon && (c as React.ReactElement).props.position === "right");

  return (
    <div className="flex items-center gap-2">
      {left}
      <input ref={ref} {...props} />
      {right}
    </div>
  );
});

Input.Addon = ({ position, children }) => <span>{children}</span>;
```

**Use compound components (Root pattern) when** children share state, accessibility requires structure, or children are interdependent. **Use simple-to-complex** when addons are optional and independent.

---

## `useEffect` — last resort

`useEffect` is for syncing with **external systems**: browser APIs, subscriptions, third-party imperative DOM.

| Scenario | Prefer instead |
|----------|---------------|
| Derived / computed values | Compute during render; `useMemo` only if profiling shows cost |
| Reset state when id changes | `key={id}` on the component so React remounts |
| Notify parent when state changes | Call parent callback in the **event handler**, not an effect |
| Server data | TanStack Query / route loaders |

**Exception — kept-mounted forms.** A drawer/modal that stays mounted (per `stack/ui-shell`, exit animations need it) can't use the `key={id}` remedy. Re-seeding its form `useState` from props on the `open` transition via `useEffect` is the sanctioned pattern there.

---

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
- [ ] Guard clauses at top; happy path flat; no `if (ok) { ... }` wrappers
- [ ] JSX: `&&` for optional UI; paired `&&` for if/else — no `? : null` or element ternaries
- [ ] Programmatic visual state exposed as `data-{name}` on the owning element (shared library)
- [ ] Default styles use `data-[…]:` so consumer `className` composes correctly
- [ ] One `cn()` call: defaults + conditional slices + caller `className` last
- [ ] Focus/hover outlines: `ring` when there is no default border; `border` only when width is always present (color change only)
- [ ] `disabled` attribute on controls + `disabled:` / `enabled:` utilities
- [ ] Compound components used when children share state or accessibility mandates structure
- [ ] No `useEffect` for derived values, prop resets, or parent notifications
- [ ] Transitions on properties that actually change
