import tryCatch from "@repo/shared/try-catch"
import { useMemo, useSyncExternalStore } from "react"
import type { AuthClient } from "@/data/auth/auth-client"
import { subscribeToToken } from "@/data/auth/token"

//---- Auth client, on first use -------------------------------------
//the better-auth SDK (data/auth/auth-client.ts) is about 9 KB gz that every page
//used to download before it could hydrate, while the first render reads nothing
//but the stored token. so it loads when something first needs it: the session
//subscription after the first render, or a sign-in, sign-up or sign-out.

/**
 * One shared load: callers that arrive together, or later, get the same
 * promise. A load that fails is forgotten, so the next caller tries again
 * rather than inheriting the failure.
 */
export function createAuthClientLoader<TClient>(
  load: () => Promise<TClient>,
): () => Promise<TClient> {
  let loading: Promise<TClient> | null = null

  return () => {
    loading ??= load().catch((error: unknown) => {
      loading = null
      throw error
    })
    return loading
  }
}

/** The auth SDK, loaded once. Every sign-in, sign-up and sign-out awaits it. */
export const loadAuthClient = createAuthClientLoader(
  async () => (await import("@/data/auth/auth-client")).authClient,
)

/** better-auth's session store as this file reads it. */
type SessionAtom<TValue> = {
  get(): TValue
  listen(listener: (value: TValue) => void): () => void
}

/**
 * The session as a store React can subscribe to, before the SDK has loaded.
 *
 * Until it has loaded, the value is `pending`, which is what better-auth itself
 * reports before its first answer. Subscribing loads it, and listening to its
 * session store is what makes better-auth read the session, as its own React
 * hook does. A load that fails changes nothing on this device, token included:
 * the session stays unanswered, and the next token write tries again, which is
 * what a sign-in that got through produces.
 */
export function createSessionSource<TValue>(options: {
  pending: TValue
  loadSession: () => Promise<SessionAtom<TValue>>
  onTokenChange: (listener: () => void) => () => void
}) {
  let value = options.pending

  function subscribe(onChange: () => void): () => void {
    let isActive = true
    let stop = () => {}

    function emit(next: TValue) {
      if (next === value) return
      value = next
      onChange()
    }

    async function attach() {
      const [session, loadError] = await tryCatch(options.loadSession)
      if (!isActive) return
      if (loadError) {
        const stopWaiting = options.onTokenChange(() => {
          stopWaiting()
          void attach()
        })
        stop = stopWaiting
        return
      }
      emit(session.get())
      stop = session.listen(emit)
    }

    void attach()
    return () => {
      isActive = false
      stop()
    }
  }

  return {
    subscribe,
    getSnapshot: () => value,
    getServerSnapshot: () => options.pending,
  }
}

type SessionValue = ReturnType<AuthClient["useSession"]["get"]>

const sessionSource = createSessionSource<SessionValue>({
  pending: {
    data: null,
    error: null,
    isPending: true,
    isRefetching: false,
    refetch: async () => {},
  },
  loadSession: async () => (await loadAuthClient()).useSession,
  onTokenChange: subscribeToToken,
})

/**
 * Whether the token this device holds still buys a session, asked of the server.
 *
 * Anything short of a clean "no session" counts as live — an unreachable or
 * failing server proves nothing about the token, and signing an offline player
 * out is worse than letting a dead token fail on the next request. An SDK that
 * failed to load proves nothing either.
 */
export async function hasLiveSession(): Promise<boolean> {
  const [result, requestError] = await tryCatch(async () =>
    (await loadAuthClient()).getSession(),
  )
  if (requestError) return true
  if (result.error) return true
  return Boolean(result.data)
}

/** A signed-in player, as the app reads them. */
export type AuthSessionUser = {
  id: string
  //the normalised handle, permanent and unique
  username: string
  //the same handle with the casing they typed. this is what the game shows.
  displayUsername: string
}

//better-auth types these as optional because the plugin's columns are nullable
//in general. in this app a user cannot exist without a username, so collapse
//them here rather than making every consumer handle a case that cannot happen.
function toSessionUser(user: {
  id: string
  username?: string | null
  displayUsername?: string | null
}): AuthSessionUser {
  const username = user.username ?? ""
  return {
    id: user.id,
    username,
    displayUsername: user.displayUsername ?? username,
  }
}

/**
 * The raw reactive session, straight from better-auth.
 *
 * `isPending` here is better-auth's own flag: it flips back to true on every
 * background revalidation while there is no cached user. `AuthProvider` flattens
 * that into a stale-while-revalidate value that only reflects the FIRST resolve,
 * and app code reads `useAuth()` rather than this.
 */
export function useSessionState() {
  const { data, error, isPending } = useSyncExternalStore(
    sessionSource.subscribe,
    sessionSource.getSnapshot,
    sessionSource.getServerSnapshot,
  )
  //a read that failed for any reason but a 401 (a 503, the network) is no
  //answer at all: the session it was asking about is still whatever it was.
  //better-auth keeps its last data then, but a cold start has none, so report
  //it as still pending rather than as a guest
  const isUnanswered = !data && Boolean(error) && error?.status !== 401
  const rawUser = data?.user ?? null
  //when the session ends, in epoch ms, for the cached summary. the SDK hands it
  //over as a Date, but a string from an older client is read the same way
  const expiresAt = toEpochMs(data?.session.expiresAt)

  //memoised on the store's own object identity: `toSessionUser` builds a new
  //object every call, and the provider writes a snapshot whenever this value
  //changes, so a fresh object per render would mean a localStorage write per
  //render.
  const user = useMemo(
    () => (rawUser ? toSessionUser(rawUser) : null),
    [rawUser],
  )

  return { user, expiresAt, isPending: isPending || isUnanswered }
}

function toEpochMs(value: Date | string | undefined): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : ms
}
