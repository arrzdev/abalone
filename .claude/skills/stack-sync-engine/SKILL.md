---
name: stack-sync-engine
description: The @repo/synq offline-first engine: HLC clock, field-level last-write-wins merge, collections and the store, the ack/retry/discard transport contract, the sync controller, and the D1 server half. Use when touching collections, sync, outbox, merge, or conflict behavior.
---

# Sync engine (`@repo/synq`)

The app is **offline-first**: every read and write hits a local store instantly, and reconciliation with the backend happens in the background. `@repo/synq` is the engine that makes that safe. Read this before touching anything under `apps/frontend/src/data/collections/`, `apps/frontend/src/data/sync/`, `apps/backend/src/services/sync.service.ts`, or `packages/synq/`.

Consuming the data layer from a page? → `stack-frontend-data` (that's the *usage* skill; this one is the *engine*).

## Mental model — one sentence per layer

| Layer | What it is | Where |
|---|---|---|
| **Merge** | field-level last-write-wins over HLC stamps | `packages/synq/src/core/merge.ts` |
| **Clock** | hybrid logical clock — causal order that survives wrong device clocks | `packages/synq/src/core/hlc.ts` |
| **Engine** | pull → merge → apply → push, per collection, with an outbox | `packages/synq/src/core/sync-engine.ts` |
| **Storage** | pluggable adapter (IndexedDB in the browser, memory for SSR/tests) | `packages/synq/src/adapters/` |
| **Store** | the app's typed register of collections | `apps/frontend/src/data/store.ts` |
| **Transport** | the pull/push pair that talks to the backend | `apps/frontend/src/data/sync/transport.ts` |
| **Controller** | decides *when* to sync and owns the status the UI shows | `apps/frontend/src/data/sync/controller.ts` |
| **Server half** | the same merge, running over D1 | `apps/backend/src/services/sync.service.ts` |

The client and the server run the **same merge code**. That is the design: convergence doesn't depend on who reconciles first.

## Package entrypoints — import the narrow one

`@repo/synq` is split so an unused half never enters a bundle. Import the specific entry, never the barrel-by-habit:

| Entry | Use for |
|---|---|
| `@repo/synq/core` | `createSynqStorage`, `singletonCollection`, `mergeDocuments`, HLC helpers |
| `@repo/synq/types` | `CollectionConfig`, `LocalDocument`, `Change`, `TxContext`, `StorageAdapter` |
| `@repo/synq/react` | `useCollection`, `useSingleton`, `SynqProvider` (React is an *optional* peer) |
| `@repo/synq/adapters/indexeddb`, `.../memory` | storage adapters — one per environment |
| `@repo/synq/protocol` | wire shapes + structural validators, shared by client **and** backend |
| `@repo/synq/server` | `createSyncServer`, `ServerDocumentStore` — backend only |

Internal machinery (`stitch`, `coalesce`, `apply`, `tx-context`) is **deliberately unexported**. If you find yourself wanting it, the interface is too small — see `core-repository-layout`, "never reach past a package's public exports".

## Documents — the reserved shape

A stored document is the developer's row plus two reserved keys:

| Key | Constant | Holds |
|---|---|---|
| `$id` | `ID_FIELD` | the document id |
| `$meta` | — | per-field HLC stamps, tombstones, conflicts |

So a UI type is **not** a stored type. `LocalDocument<TRow>` is what comes back from a read; map it at the edge:

```ts
export function toItem(doc: LocalDocument<SyncItem>): Item {
  return { id: doc.$id, title: doc.title, dueAt: doc.dueAt != null ? new Date(doc.dueAt) : undefined }
}
```

**Timestamps on the wire are epoch ms, not `Date`.** Sync rows must be JSON-safe, so a collection's row type uses `number` and the query layer converts to `Date` for the UI. Putting a `Date` in a collection row is a bug that only shows up after a round-trip.

## Adding a collection (the whole surface)

Four files under `data/collections/<domain>/`, then one line in the store:

```ts
//data/collections/items/items.collection.ts — row shape + transport
export type SyncItem = { title: string; checked: boolean; createdAt: number }

export const itemsCollection: CollectionConfig<SyncItem> = {
  name: "items",
  ...backendTransport<SyncItem>("items"),
}
```

```ts
//data/store.ts — register it
export const store = createSynqStorage({
  storageAdapter,
  collections: { items: itemsCollection, preferences: preferencesCollection },
})
```

Then `schema.ts` (the UI type), `queries.ts` (reactive reads), `mutations.ts` (writes) — see `stack-frontend-data` for those three.

**Local-only collections** skip the transport entirely. A settings blob is a **singleton**:

```ts
export const preferencesCollection = singletonCollection<Preferences>("preferences", DEFAULT_PREFERENCES)
```

`singletonCollection` = one row, defaults baked in, no pull/push. Read it with `useSingleton(store.preferences)`. Reach for it before inventing a one-row collection with ad-hoc defaults.

## The transport contract

One generic `backendTransport(collection)` serves every synced collection — only the name differs. Do **not** write a per-collection transport.

`pull(cursor)` returns `{ changes, nextCursor }`. `push(changes, ctx)` must resolve **every** change through the `TxContext`, and the choice is semantic:

| Outcome | Call | When |
|---|---|---|
| Accepted | `ctx.ack(opId)` | server said `ok` |
| Keep and retry | `ctx.retry(opId, error)` | transient — network, 5xx, error envelope, no ack |
| Drop permanently | `ctx.discard(opId, error)` | structural rejection; retrying the same payload can never succeed |

Getting this wrong is how you build an infinite retry loop (`retry` on a permanently-invalid doc) or silent data loss (`discard` on a transient failure). **When in doubt, `retry`** — the outbox is durable and the row stays local.

## The controller — when, not how

`data/sync/controller.ts` owns triggers and status. Facts worth not rediscovering:

- **Triggers:** a local change (debounced 2s), sign-in/startup, offline → online, and app/tab visibility+focus. **No periodic polling** — that is deliberate.
- **Retry** is a fixed 1-minute timer, capped at 3 attempts, then it waits for activity. A dead backend is never polled forever.
- **`dirty` clears only on a real success**, so the status indicator never lies.
- **One request per synced collection is expected, not a bug.** `store.sync()` runs each collection through its own pull/push round-trip, so a cycle reads on the wire as `pull;push;pull` for two collections. Collapsing it would need a batched endpoint *and* a batched engine path — deliberately not done, because per-collection cursors keep the model simple.
- Sync is **user-scoped**: the RPC client attaches the bearer token, the server scopes rows by it, and the controller only runs when authenticated. Guests stay fully local.

## Server half

`SyncService` implements `ServerDocumentStore` over D1 (`documents` + `sync_counters` tables) and nothing else. **All sync semantics — validation, merge, cursor derivation, seq assignment — live in `createSyncServer`.** Do not re-implement merge or conflict rules in the service; if the behavior is wrong, it's wrong in `packages/synq`, and fixing that is a scoped-package change (`core-repository-layout`).

Routes are generic: `POST /api/v1/sync/:collection/{pull,push}`. Adding a collection needs **no backend route change**.

## Traps

- **Never mutate a document in place.** Merge is a join over semilattices — commutative, associative, idempotent. Local mutation breaks that guarantee, and the symptom is divergence on a *different* device days later.
- **`$id` / `$meta` are reserved.** A row field named either one collides with the metadata layer.
- **A collection row must be JSON-serializable.** No `Date`, no `Map`, no class instance.
- **SSR/import-time safety:** `store.ts` picks the memory adapter when `indexedDB` is undefined. Keep that guard — module-scope IndexedDB access breaks the SSR render.
- **Wiping local state** goes through `resetLocalStore()` (`store.resetLocal()`), which clears rows + outbox + cursors in place and notifies subscribers, so the UI re-renders empty with **no page reload**. It's local-only: it never enqueues deletions upstream. Used on sign-out and before pulling a different account's data.
- **Conflicts are preserved, not silently dropped** — when a base is known, the LWW loser lands in `$meta.conflicts`. If you're surfacing conflicts in UI, read them from there rather than diffing yourself.

## Testing

`packages/synq` has the repo's densest test suite (`vitest` + `fake-indexeddb`) — merge, HLC, coalesce, stitch, sync-engine, adapters, leader election. **Any change to merge or clock semantics needs a test in `packages/synq/src/core/`.** Run it with `pnpm --filter @repo/synq test`. See `stack-testing-setup`.
