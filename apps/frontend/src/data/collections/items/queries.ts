import { useCollection } from "@repo/synq/react"
import type { LocalDocument } from "@repo/synq/types"
import { useMemo } from "react"
import type { SyncItem } from "@/data/collections/items/items.collection"
import type { Item } from "@/data/collections/items/schema"
import { store } from "@/data/store"

//map a synced item document (epoch ms timestamps) to the UI Item (Date)
export function toItem(doc: LocalDocument<SyncItem>): Item {
  return {
    id: doc.$id,
    title: doc.title,
    done: doc.done,
    position: doc.position,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  }
}

//reactive, offline-first read. data is served from the warm in-memory cache
//instantly and kept live by the local storage stream; the background sync
//controller (data/sync/controller) reconciles with the server.
export function useItems(): { data: Item[]; isLoading: boolean } {
  const { data, isLoading } = useCollection(store.items)
  const items = useMemo(
    () => data.map(toItem).sort((a, b) => a.position - b.position),
    [data],
  )
  return { data: items, isLoading }
}
