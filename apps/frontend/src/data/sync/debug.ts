import {
  createItem,
  deleteItem,
  renameItem,
  setItemDone,
} from "@/data/collections/items/mutations"
import { store } from "@/data/store"
import { runSync } from "@/data/sync/controller"

//---- Debug / e2e hook ---------------------------------------------
//exposes the real offline-first data layer on window so devtools (or an
//automated browser) can drive the exact code paths the UI buttons use and
//force a sync deterministically. browser-only; no-op during prerender.

declare global {
  interface Window {
    synqDebug?: {
      createItem: typeof createItem
      renameItem: typeof renameItem
      setItemDone: typeof setItemDone
      deleteItem: typeof deleteItem
      runSync: typeof runSync
      list: () => ReturnType<typeof store.items.query>
    }
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.synqDebug = {
    createItem,
    renameItem,
    setItemDone,
    deleteItem,
    runSync,
    list: () => store.items.query(),
  }
}
