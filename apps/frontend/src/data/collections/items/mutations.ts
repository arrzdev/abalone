import type { LocalDocument } from "@repo/synq/types"
import type { SyncItem } from "@/data/collections/items/items.collection"
import { nextPosition } from "@/data/collections/positions"
import { store } from "@/data/store"

type ItemDoc = LocalDocument<SyncItem>

//all writes go through synq: they land in the local outbox instantly
//(optimistic) and the sync controller — subscribed to this collection's
//onLocalChange — flushes them to the backend on a debounce. no mutation
//ever calls the sync controller itself.

export async function createItem(title: string): Promise<void> {
  const existing = (await store.items.query()) as ItemDoc[]
  const now = Date.now()
  await store.items.insert({
    title,
    done: false,
    position: nextPosition(existing),
    createdAt: now,
    updatedAt: now,
  })
}

export async function renameItem(
  id: string,
  title: string,
): Promise<void> {
  await store.items.update(id, { title, updatedAt: Date.now() })
}

export async function setItemDone(
  id: string,
  done: boolean,
): Promise<void> {
  await store.items.update(id, { done, updatedAt: Date.now() })
}

export async function deleteItem(id: string): Promise<void> {
  await store.items.delete(id)
}
