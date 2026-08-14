import type { AuthSessionUser } from "@/data/auth/client"
import {
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "@/data/snapshot"

const SESSION_SNAPSHOT_KEY = "abalone.session"

/**
 * What this device last knew about who is signed in.
 *
 * `null` means "never resolved here", which is a different thing from
 * `{ user: null }` meaning "resolved, and it was a guest". The distinction earns
 * its nesting level: it lets a returning guest paint instantly too, instead of
 * sitting behind the same spinner as a genuinely first visit.
 */
export type SessionSnapshot = { user: AuthSessionUser | null }

export function readSessionSnapshot(): SessionSnapshot | null {
  const snapshot = readSnapshot<SessionSnapshot>(SESSION_SNAPSHOT_KEY)
  if (!snapshot) return null
  return { user: snapshot.user ?? null }
}

export function writeSessionSnapshot(user: AuthSessionUser | null): void {
  writeSnapshot<SessionSnapshot>(SESSION_SNAPSHOT_KEY, { user })
}

export function clearSessionSnapshot(): void {
  clearSnapshot(SESSION_SNAPSHOT_KEY)
}
