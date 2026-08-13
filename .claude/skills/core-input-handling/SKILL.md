---
name: core-input-handling
description: Choosing between uncontrolled refs, controlled state, debounced handlers, and URL-driven state for form and search inputs. Use when building an input, search box, filter, debounce, or a form inside a drawer or modal.
---

# Input handling

**Prefer the app's `components/ui` wrappers** over raw HTML or new field primitives — they wrap the shared UI package with brand styling. Read that folder for the actual names before writing a field (`stack-ui-shell`).

**Default shareable / persistent UI state (filters, tabs, selection) to the URL** (`nuqs`) — it's linkable and survives reload. Reach for `useState` only for ephemeral state.

These patterns assume a `useDebounce` hook and `nuqs` for URL state. Neither is a heavy dependency, but **check what the app already has before importing either** — a debounce hook is a dozen lines to write locally, and adding a package is a decision to raise (`core-agent-behavior`). Where a given repo stands: its `stack/` skills.

**Choose in order:**

1. No re-render while typing → uncontrolled `useRef`, read `.current.value` on submit or in a debounced handler.
2. UI derives from each keystroke → controlled `useState` + `value` / `onChange`.
3. Expensive work → debounce the handler (250–400ms); debounce straight to the final state or action, no extra state layers.
4. Shareable filter → URL state. Client-only: debounce writes to the URL. **Server-backed search:** instant URL + separate debounced state for the query (Pattern 4b).

## Pattern 1: Uncontrolled (ref)

```tsx
const nameRef = useRef<HTMLInputElement>(null)

function handleSubmit() {
  const name = nameRef.current?.value ?? ""
}

<Input ref={nameRef} defaultValue="" placeholder="Name…" />
```

## Pattern 2: Controlled (state)

```tsx
const [message, setMessage] = useState("")

<Input value={message} onChange={(e) => setMessage(e.target.value)} />
{message.trim() && <button>Send</button>}
```

## Pattern 3: Debounced handler

```tsx
const searchRef = useRef<HTMLInputElement>(null)
const debouncedSearch = useDebounce((e: ChangeEvent<HTMLInputElement>) => {
  performSearch(e.target.value)
}, 300)

<Input ref={searchRef} defaultValue="" onChange={debouncedSearch} />
```

## Pattern 4: Debounced → URL (client-side filter)

URL is single source of truth; filters react to URL state, not the input value.

```tsx
const [urlQuery, setUrlQuery] = useQueryState("q", parseAsString.withDefault(""))
const searchRef = useRef<HTMLInputElement>(null)

const debouncedUpdateUrl = useDebounce((e: ChangeEvent<HTMLInputElement>) => {
  setUrlQuery(e.target.value || null)
}, 250)

const filtered = useMemo(
  () =>
    items.filter(
      (i) => !urlQuery.trim() || i.name.toLowerCase().includes(urlQuery.trim()),
    ),
  [items, urlQuery],
)

<Input ref={searchRef} defaultValue={urlQuery} onChange={debouncedUpdateUrl} />
```

## Pattern 4b: Instant URL + debounced query state (server-side search)

nuqs updates on every keystroke (shareable URL); the debounced state is what the query hook sees.

```tsx
const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""))
const [debouncedSearch, setDebouncedSearch] = useState(search)
const skipSyncRef = useRef(false)

const debouncedSetDebounced = useDebounce((value: string) => {
  setDebouncedSearch(value)
}, 250)

useEffect(() => {
  if (!skipSyncRef.current) setDebouncedSearch(search)
  skipSyncRef.current = false
}, [search])

function handleChange(value: string) {
  setSearch(value || null)
  skipSyncRef.current = true
  debouncedSetDebounced(value)
}

const { data } = usePaginatedSearch({ search: debouncedSearch || undefined })

<Input type="search" value={search} onChange={(e) => handleChange(e.target.value)} />
```

## Forms in a kept-mounted container

A drawer or modal that stays **mounted** (exit animations need the root in the tree) can't use the `key={id}` remount trick to reset form state. Re-seed the form's `useState` from props on the `open` transition via `useEffect` — the sanctioned exception in `core-react-components`.

Run submission through the app's shared mutation hook rather than a per-form `tryCatch` / `setError`, and gate the close on success.

## Rules

1. Never use `useState` for inputs that don't trigger re-renders — use refs.
2. Never create intermediate state for debouncing — debounce directly to the final state or action.
3. Use `defaultValue` for uncontrolled; `value` only for controlled.
4. URL state is single source of truth when used — filters react to the URL, not the input value.
5. Debounce delay: 250–400ms.
6. A pattern here needing a package the repo doesn't have yet is a **dependency decision** — ask, then implement it to match. Don't silently call a hook that doesn't exist.
