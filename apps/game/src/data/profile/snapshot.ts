import type { Profile } from "@/data/profile/queries"
import {
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "@/data/snapshot"

//kept apart from the query that fills it so the end of a session can drop it
//without importing the data layer it belongs to — the reverse of that import
//is the api client, and a session ends from inside a reply the api client read

const PROFILE_SNAPSHOT_KEY = "abalone.profile"

export function readProfileSnapshot(): Profile | null {
  return readSnapshot<Profile>(PROFILE_SNAPSHOT_KEY)
}

export function writeProfileSnapshot(profile: Profile): void {
  writeSnapshot<Profile>(PROFILE_SNAPSHOT_KEY, profile)
}

/** Dropped when a session ends, so the next player never sees this face. */
export function clearProfileSnapshot(): void {
  clearSnapshot(PROFILE_SNAPSHOT_KEY)
}
