import tryCatch from "@repo/shared/try-catch"
import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client"
import { del, get, set } from "idb-keyval"
import { CACHE_MAX_AGE } from "@/providers/query-client"

const CACHE_KEY = "abalone-query-cache"

/**
 * What version of the cached shapes this build can read.
 *
 * Bump it whenever a persisted payload changes shape — a renamed field, a new
 * required one — and every device drops what it saved instead of restoring a
 * board the screen can no longer read.
 *
 * Not the service worker's build tag, which would be the obvious answer: that
 * tag is a hash *of* the client bundle, so it exists only once the bundle is
 * built and cannot be a constant inside it. Tying the cache to it would also
 * mean every deploy wipes every saved game, which is the opposite of the point.
 */
const CACHE_VERSION = "1"

/**
 * The saved cache, in IndexedDB.
 *
 * Every call is wrapped because storage is not always there — private windows
 * and a full disk both throw — and a device that cannot save its cache should
 * still be able to play. Failing to persist is not failing.
 */
export const persister: Persister = {
  persistClient: async (client) => {
    await tryCatch(() => set(CACHE_KEY, client))
  },
  restoreClient: async () => {
    const [client] = await tryCatch(() => get<PersistedClient>(CACHE_KEY))
    return client ?? undefined
  },
  removeClient: async () => {
    await tryCatch(() => del(CACHE_KEY))
  },
}

export const persistOptions: Omit<
  PersistQueryClientOptions,
  "queryClient"
> = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: CACHE_VERSION,
  dehydrateOptions: {
    //a move held back by a dead network is worth retrying in the tab that made
    //it, and worth forgetting after that. restoring one a day later would
    //replay it into a game that has moved on — the server would refuse it on
    //`moveIndex`, but the right place to not send it is here
    shouldDehydrateMutation: () => false,
  },
}
