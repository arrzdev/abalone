---
name: stack-frontend-data
description: The two data paths in src/data/: local-first synq collections for domain data, and typed RPC plus TanStack Query for genuine server calls. Covers reads, optimistic writes via useDataMutation, and the RPC client. Use when touching src/data/, a query, or a mutation.
---

# Frontend data layer

## Core rule

**`src/data/` is the source of truth** for all fetching, persistence, and upstream I/O.

Components, pages, and layouts **do not** call `fetch`, RPC clients, or local DB APIs directly — they consume hooks/functions exported from `data/`.

## Two paths — know which one you're on

| Path | Use for | Primitive |
|---|---|---|
| **Local / offline-first** | app domain data the user owns | a local store + reactive read hook |
| **Server request** | genuinely remote calls | typed RPC client + TanStack Query |

**In this repo:** app domain data (items, preferences) is **local-first via `@repo/synq`** and is *not* fetched — it's read from the local store, which the sync controller reconciles in the background. TanStack Query is wired and owns the **server** surface (today: auth). Engine internals: `stack-sync-engine`.

Picking the wrong path is the most common mistake here: wrapping a local collection in a query cache gives you two sources of truth.

## Online (the server path)

TanStack Query — `queryOptions` / `mutationOptions`, typed HTTP client in `queryFn` / `mutationFn`, invalidation helpers.

| Do | Do not |
|----|--------|
| Options factories in `data/`; client inside `queryFn` / `mutationFn` | `useEffect` + `fetch` for server-backed reads in UI |
| `useQuery(…Options)` / `useMutation({ …Options })` | `useState` as source of truth for fetched data |
| Invalidate via `queryClient` + small helpers | Parallel ad-hoc fetch patterns in components |

**Exceptions:** static assets, env-only values (`@/env/registry`), third-party widgets, streams with a defined separate pattern.

## Offline-first

Local persistence under `data/` is valid when the app is offline-first. Hybrid sync lives under `data/` — follow the patterns in the app being edited.

**Offline-first query factory** — the "no DB in components" rule applies to the local store too. Don't call `db.*` / `store.*` in a page; wrap the read in a `data/` module and import it, exactly like the online path.

```ts
//this repo — synq collections
//data/collections/items/queries.ts
export function useItems(): { data: Item[]; isLoading: boolean } {
  const { data, isLoading } = useCollection(store.items)
  const items = useMemo(() => data.map(toItem), [data])
  return { data: items, isLoading }
}
```

```ts
//the same rule with a Dexie-backed store
//data/items/items.queries.ts
export function useItemsQuery() {
  return useDexieQuery({ queryFn: () => db.items.orderBy("position").toArray() })
}
```

The page calls `useItems()` / `useItemsQuery()`, never `store.items.query()` or `db.items.toArray()` directly — same source-of-truth rule, a local DB instead of HTTP.

The reactive read is **already live**: it re-renders on every local write and on sync. Do not add a refetch, an effect, or an invalidation layer on top of it. Singletons (a settings blob) use `useSingleton(store.preferences)`.

**Map stored documents to UI types in the query module.** A synq row uses epoch-ms numbers and reserved `$id` / `$meta` keys; the UI type uses `Date` and `id`. Keep that conversion in one place per domain (`toItem`) rather than at each call site.

**Offline-first mutations** — local optimistic writes (synq/Dexie) are **not** TanStack mutations: there's no server cache/retry to manage (the outbox owns retry), and the reactive read (`useCollection` / `useDexieQuery`) already re-renders on the write. So:

- `data/<domain>/mutations.ts` exports plain async write fns (the local write + a `scheduleSync()`).
- Components run them through **one shared hook** (`useDataMutation`, `src/hooks/use-data-mutation.ts`) that owns `run` + `error` + `isPending` — never re-implement a per-page `tryCatch` / `setError` wrapper:

  ```ts
  const { run, error, isPending } = useDataMutation()
  //close the drawer only on success:
  if (await run(() => createItem(value), "Could not save task.")) onClose()
  ```

- `run` resolves to `true` on success, so a caller can gate its close/reset on it.
- The fallback is a **stable, one-line** message — it's what the UI shows (the raw write error becomes the `cause`), so an inline error slot can reserve a fixed height (no layout shift).
- Use TanStack `mutationOptions` (below) only for the **server** path (`api.*`).

## Layout (intentionally loose)

Do not force every feature into rigid `queries/` + `mutations/` + `revalidations/` subfolders.

- Put concerns under `data/<domain>/` with `{domain}.{role}.ts` naming where it fits (`items.schema.ts`, `items.mutations.ts`, …). **Once a domain has its own folder, filenames drop the domain** and use the bare role — the folder already carries it (`collections/items/queries.ts`, not `items/items.queries.ts`). See `core-repository-layout`.
- One typed client module per upstream — extend it, do not duplicate.
- No mandatory `data/index.ts` barrel — import concrete modules.

This repo's shape:

```
data/
  store.ts                        # the synq register — every collection, one typed store
  backend-client.ts               # the typed RPC client + backendBaseUrl
  collections/<domain>/
    <domain>.collection.ts        # row shape (JSON-safe) + transport
    schema.ts                     # the UI-facing type
    queries.ts                    # reactive reads + doc → UI mapping
    mutations.ts                  # plain async write functions
  sync/                           # controller, transport, abort signal
  auth/                           # client, token, social providers
```

## Typed RPC client

1. `import type` the routes interface from the API workspace export (`@repo/backend/http/interface`) — no runtime server imports.
2. Construct **one** client and give it the app's auth mode:
   - **Bearer token** (this repo): a `headers()` callback injects the session token, so no call site attaches `Authorization` by hand.
   - **Cookie sessions:** `hc<RoutesInterface>(baseUrl, { init: { credentials: "include" } })`.
3. Infer types at call sites: `InferRequestType` / `InferResponseType` from `hono/client`.
4. Forward `signal` in `queryFn` for cancellation.

```ts
export const api = hc<RoutesInterface>(backendBaseUrl, {
  headers(): Record<string, string> {
    const token = getBearerToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})
```

**`backendBaseUrl` resolves the origin once** — in dev the backend shares the host on its own port, in prod it's `VITE_BACKEND_URL`. Non-RPC callers (the sync transport) reuse it rather than rebuilding a URL.

**`withClientRequest` wraps fetch/client throws only** — it turns a network failure into a stable user-facing message and re-throws `AbortError` untouched. Envelope handling (`status !== "success"`) stays in the `queryFn` / `mutationFn` / transport. Don't use it to swallow domain errors.

## Queries

```ts
export const thingQueryKey = (id: string) => ["thing", id] as const

export const thingQueryOptions = (id: string) =>
  queryOptions({
    queryKey: thingQueryKey(id),
    queryFn: async ({ signal }) => {
      const res = await api.things[":id"].$get({ param: { id } }, { init: { signal } })
      if (!res.ok) throw new Error("fetch failed")
      return res.json()
    },
  })
```

## Mutations

```ts
export const createThingMutationOptions = mutationOptions({
  mutationFn: async (input: CreateThingInput) => {
    const res = await api.things.$post({ json: input })
    if (!res.ok) throw new Error("create failed")
    return res.json()
  },
})
```

Attach `onSuccess` / `onSettled` at the callsite with `queryClient` and invalidation helpers.

This is the **server** path. Local optimistic writes don't use `mutationOptions` — see *Offline-first mutations* above.

## UI layer

Screens import query/mutation options from `data/` — not the raw `api` client, and not `store`, unless explicitly excepted.
