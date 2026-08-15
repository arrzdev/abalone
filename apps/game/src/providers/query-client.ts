import { QueryClient } from "@tanstack/react-query"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How old a saved cache may be and still be worth restoring.
 *
 * A week, because the thing most worth having without a network is a finished
 * game, and a game that ended last Tuesday is the same game today.
 */
export const CACHE_MAX_AGE = 7 * DAY_MS

//a restored query is garbage-collected on its own timer, which starts the
//moment nothing is observing it. anything meant to survive a cold start has to
//outlive the snapshot it came from, or it is dropped somewhere between the
//restore and the screen that wanted it
const CACHE_GC_TIME = CACHE_MAX_AGE + DAY_MS

//one client for the app's whole server surface: the profile, and the invites
//and games behind it. `staleTime` is the default for the quiet half of that —
//the online queries set their own, because how often a board is worth asking
//about depends on whether the other player is the one being waited on.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_GC_TIME,
      retry: 1,
    },
  },
})
