import type { CollectionConfig } from "@repo/synq/types"
import { backendTransport } from "@/data/sync/transport"

//---- Items collection ---------------------------------------------
//the boilerplate's one SYNCED collection — a worked example of the whole
//offline-first path: this file owns the row shape + its transport,
//data/store.ts registers it, and the synq engine drives merge + outbox.
//copy this folder to add a collection of your own (rename `name`, the
//transport's collection string, and the row type). timestamps are epoch ms
//(JSON-safe); the UI converts to Date at the edge (see queries.ts).

export type SyncItem = {
  title: string
  done: boolean
  //custom-sort order; append lands at max+1 (see data/collections/positions)
  position: number
  createdAt: number
  updatedAt: number
}

export const itemsCollection: CollectionConfig<SyncItem> = {
  name: "items",
  ...backendTransport<SyncItem>("items"),
}
