---
name: input-handling
description: >-
  Ref vs useState for inputs, debounce, nuqs URL sync, server-side search split.
  Load for forms, search fields, filters tied to URL, or any controlled/uncontrolled input decision.
---

# Input handling

**Prefer app `components/ui` wrappers** (`AppInput`, `AppButton`, …) over raw HTML or new field primitives — they wrap the shared UI package with brand styling.

**Default shareable / persistent UI state (filters, tabs, selection) to the URL** (`nuqs`) — it's linkable and survives reload. Reach for `useState` only for ephemeral state.

**Choose in order:**

1. No re-render while typing → uncontrolled `useRef`, read `.current.value` on submit or debounced handler.
2. UI derives from each keystroke → controlled `useState` + `value`/`onChange`.
3. Expensive work → debounce the handler (250–400ms); debounce straight to URL or callback, no extra state layers.
4. Shareable filter → `nuqs` (`useQueryState`). Client-only: debounce writes to URL. **Server-backed search:** instant URL + separate debounced state for the query (Pattern 4b).

---

## Pattern 1: Uncontrolled (ref)

```tsx
const nameRef = useRef<HTMLInputElement>(null);

const handleSubmit = () => {
  const name = nameRef.current?.value || "";
};

<Input ref={nameRef} defaultValue="" placeholder="Name…" />
```

---

## Pattern 2: Controlled (state)

```tsx
const [message, setMessage] = useState("");

<Input value={message} onChange={(e) => setMessage(e.target.value)} />
{message.trim() && <button>Send</button>}
```

---

## Pattern 3: Debounced handler

```tsx
const searchRef = useRef<HTMLInputElement>(null);
const debouncedSearch = useDebounce((e: ChangeEvent<HTMLInputElement>) => {
  performSearch(e.target.value);
}, 300);

<Input ref={searchRef} defaultValue="" onChange={debouncedSearch} />
```

---

## Pattern 4: Debounced → URL (client-side filter)

URL is single source of truth; filters react to URL state, not the input value.

```tsx
const [urlQuery, setUrlQuery] = useQueryState("q", parseAsString.withDefault(""));
const searchRef = useRef<HTMLInputElement>(null);

const debouncedUpdateUrl = useDebounce((e: ChangeEvent<HTMLInputElement>) => {
  setUrlQuery(e.target.value || null);
}, 250);

const filtered = useMemo(() =>
  items.filter(i => !urlQuery.trim() || i.name.toLowerCase().includes(urlQuery.trim())),
  [items, urlQuery]
);

<Input ref={searchRef} defaultValue={urlQuery} onChange={debouncedUpdateUrl} />
```

---

## Pattern 4b: Instant URL + debounced query state (server-side search)

nuqs updates on every keystroke (shareable URL); debounced state is what the query hook sees.

```tsx
const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
const [debouncedSearch, setDebouncedSearch] = useState(search);
const skipSyncRef = useRef(false);

const debouncedSetDebounced = useDebounce((value: string) => {
  setDebouncedSearch(value);
}, 250);

// Sync URL → debouncedSearch only when change came from outside (back/forward)
useEffect(() => {
  if (!skipSyncRef.current) setDebouncedSearch(search);
  skipSyncRef.current = false;
}, [search]);

const handleChange = (value: string) => {
  setSearch(value || null);
  skipSyncRef.current = true;
  debouncedSetDebounced(value);
};

const { data } = usePaginatedSearch({ search: debouncedSearch || undefined });

<Input type="search" value={search} onChange={(e) => handleChange(e.target.value)} />
```

---

## Rules

1. Never use `useState` for inputs that don't trigger re-renders — use refs.
2. Never create intermediate state for debouncing — debounce directly to final state/action.
3. Use `defaultValue` for uncontrolled; `value` only for controlled.
4. URL state is single source of truth when used — filters react to URL, not input value.
5. Debounce delay: 250–400ms.
