import { queryOptions, useQuery } from "@tanstack/react-query"
import { api, apiError, withClientRequest } from "@/data/backend-client"
import {
  readProfileSnapshot,
  writeProfileSnapshot,
} from "@/data/profile/snapshot"
import { useAuth } from "@/providers/auth-provider"

/** The player as the app shows them. Mirrors the backend's profile shape. */
export type Profile = {
  username: string | null
  displayUsername: string | null
  //absolute, immutable, and cacheable forever, or null until they upload one
  avatarUrl: string | null
}

export const profileQueryKey = ["profile", "me"] as const

/**
 * The signed-in player's own profile.
 *
 * `enabled` is the auth gate: a guest never fires this, which is what keeps the
 * app fully usable signed out. The snapshot is what makes a reload paint the
 * right avatar immediately instead of a placeholder that swaps a moment later.
 */
export function profileQueryOptions(isAuthenticated: boolean) {
  //the data type is stated rather than inferred: `placeholderData` accepts both
  //a value and a factory, so a bare factory gets read as the value itself and
  //the whole query infers as a function type.
  return queryOptions<Profile>({
    queryKey: profileQueryKey,
    queryFn: async ({ signal }) => {
      const response = await withClientRequest(() =>
        api.api.v1.profile.me.$get({}, { init: { signal } }),
      )
      const body = await response.json()
      if (body.status !== "success") throw apiError(body.error_code)

      //written here rather than in an onSuccess so there is exactly one place
      //that knows a fresh profile has arrived
      writeProfileSnapshot(body.data.profile)
      return body.data.profile
    },
    enabled: isAuthenticated,
    //the avatar is the only thing that can change, and only from this device
    staleTime: 5 * 60_000,
    placeholderData: () => readProfileSnapshot() ?? undefined,
  })
}

/**
 * The profile, wired to the session. The one read every screen uses: a guest
 * gets `undefined` and fires no request.
 */
export function useProfile() {
  const { isAuthenticated } = useAuth()
  return useQuery(profileQueryOptions(isAuthenticated))
}
