import { usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { useMemo } from "react"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"

//---- Auth client --------------------------------------------------
//better-auth's SDK is the auth data layer: it drives sign-up, sign-in and
//sign-out against the mounted handler and exposes a reactive session. the token
//half is wired here once — read it on the way out, stash it on the way back —
//so nothing downstream handles a header.

export const authClient = createAuthClient({
  //full path: the handler is mounted at the api's /api/v1/auth basePath
  baseURL: `${backendBaseUrl}/api/v1/auth`,
  //the server's `username()` plugin has a client half, and without it
  //`signIn.username` does not exist
  plugins: [usernameClient()],
  fetchOptions: {
    auth: { type: "Bearer", token: getBearerToken },
    onSuccess: (context) => {
      const token = context.response.headers.get("set-auth-token")
      if (token) writeToken(token)
    },
  },
})

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
  const { data, isPending } = authClient.useSession()
  const rawUser = data?.user ?? null

  //memoised on the store's own object identity: `toSessionUser` builds a new
  //object every call, and the provider writes a snapshot whenever this value
  //changes, so a fresh object per render would mean a localStorage write per
  //render.
  const user = useMemo(
    () => (rawUser ? toSessionUser(rawUser) : null),
    [rawUser],
  )

  return { user, isPending }
}
