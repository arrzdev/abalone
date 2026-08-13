---
name: frontend-data
description: >-
  src/data as source of truth for I/O; TanStack Query default for online; Dexie/offline OK;
  typed RPC client, queryOptions/mutationOptions. Load for data fetching, cache, mutations, sync.
---

# Frontend data layer

## Core rule

**`src/data/` is the source of truth** for all fetching, persistence, and upstream I/O.

Components, pages, and layouts **do not** call `fetch`, RPC clients, or local DB APIs directly — they consume hooks/functions exported from `data/`.

## Online (default)

TanStack Query — `queryOptions` / `mutationOptions`, typed HTTP client in `queryFn` / `mutationFn`, invalidation helpers.

| Do | Do not |
|----|--------|
| Options factories in `data/`; client inside `queryFn` / `mutationFn` | `useEffect` + `fetch` for server-backed reads in UI |
| `useQuery(…Options)` / `useMutation({ …Options })` | `useState` as source of truth for fetched data |
| Invalidate via `queryClient` + small helpers | Parallel ad-hoc fetch patterns in components |

**Exceptions:** static assets, env-only values, third-party widgets, streams with a defined separate pattern.

## Offline-first

Local persistence (e.g. Dexie under `data/`) is valid when the app is offline-first. Hybrid sync lives under `data/` — follow patterns in the app being edited.

**Offline-first query factory** — the "no DB in components" rule applies to Dexie too. Don't call `db.*` in a page; wrap the read in a `data/<domain>/` module and import it, exactly like the online path:

```ts
// data/items/items.queries.ts
export function useItemsQuery() {
  return useDexieQuery({ queryFn: () => db.items.orderBy("position").toArray() })
}
```

The page calls `useItemsQuery()`, never `db.items.toArray()` directly — same source-of-truth rule, Dexie instead of HTTP.

**Offline-first mutations** — local optimistic writes (synq/Dexie) are **not** TanStack mutations: there's no server cache/retry to manage, and the reactive read (`useCollection` / `useDexieQuery`) already re-renders on the write. So:

- `data/<domain>/mutations.ts` exports plain async write fns (the local write + a `scheduleSync()`).
- Components run them through **one shared hook** (`useDataMutation`) that owns `run` + `error` + `isPending` — never re-implement a per-page `tryCatch`/`setError` wrapper:

  ```ts
  const { run, error, isPending } = useDataMutation()
  // close the drawer only on success:
  if (await run(() => createItem(value), "Could not save task.")) onClose()
  ```

- The fallback is a **stable, one-line** message — it's what the UI shows (the raw write error becomes the `cause`), so an inline error slot can reserve a fixed height (no layout shift).
- Use TanStack `mutationOptions` (below) only for the **server** path (`api.*`).

## Layout (intentionally loose)

Do not force every feature into rigid `queries/` + `mutations/` + `revalidations/` subfolders.

- Put concerns under `data/<domain>/` with `{domain}.{role}.ts` naming where it fits (`items.schema.ts`, `items.mutations.ts`, …).
- One typed client module per upstream — extend it, do not duplicate.
- No mandatory `data/index.ts` barrel — import concrete modules.

## Typed RPC client

1. `import type` the routes interface from the API workspace export — no runtime server imports.
2. `hc<RoutesInterface>(baseUrl, { init: { credentials: "include" } })` when cookie sessions.
3. Infer types at call sites: `InferRequestType` / `InferResponseType` from `hono/client`.
4. Forward `signal` in `queryFn` for cancellation.

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

Screens import query/mutation options from `data/` — not the raw `api` client unless explicitly excepted.
