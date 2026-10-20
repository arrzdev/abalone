import type { AuthSessionUser } from "@/data/auth/client"
import {
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "@/data/snapshot"

const SESSION_SNAPSHOT_KEY = "abalone.session"

/**
 * What this device last knew about who is signed in: a summary, never a token.
 *
 * `null` means "never resolved here", which is a different thing from
 * `{ user: null }` meaning "resolved, and it was a guest". The distinction earns
 * its nesting level: it lets a returning guest paint instantly too, instead of
 * sitting behind the same spinner as a genuinely first visit.
 *
 * `expiresAt` (epoch ms) is when the session behind `user` ends. A summary past
 * it is denied at once rather than painted until the api says so.
 */
export type SessionSnapshot = {
  user: AuthSessionUser | null
  expiresAt?: number
}

type StoredSnapshot = {
  user?: AuthSessionUser | null
  expiresAt?: unknown
}

function expiresAtOf(stored: StoredSnapshot): number | undefined {
  return typeof stored.expiresAt === "number"
    ? stored.expiresAt
    : undefined
}

/**
 * Whether this device holds a summary of a session that has already ended.
 *
 * Only a summary that names its end can be past it: one written before the
 * summary carried `expiresAt` proves nothing either way, and the api answers it
 * on the next read.
 */
export function isSessionSnapshotExpired(now = Date.now()): boolean {
  const stored = readSnapshot<StoredSnapshot>(SESSION_SNAPSHOT_KEY)
  if (!stored?.user) return false
  const expiresAt = expiresAtOf(stored)
  return expiresAt !== undefined && expiresAt <= now
}

export function readSessionSnapshot(
  now = Date.now(),
): SessionSnapshot | null {
  const stored = readSnapshot<StoredSnapshot>(SESSION_SNAPSHOT_KEY)
  if (!stored) return null

  const user = stored.user ?? null
  if (!user) return { user: null }

  //a signed-in summary is only served while it can say it is still live: an
  //expired one is no user at once, and one that cannot say (an older shape) is
  //no answer at all, so the first paint waits for the api instead of guessing
  const expiresAt = expiresAtOf(stored)
  if (expiresAt === undefined) return null
  if (expiresAt <= now) return { user: null, expiresAt }
  return { user, expiresAt }
}

export function writeSessionSnapshot(
  user: AuthSessionUser | null,
  expiresAt?: number,
): void {
  writeSnapshot<SessionSnapshot>(
    SESSION_SNAPSHOT_KEY,
    user ? { user, expiresAt } : { user: null },
  )
}

export function clearSessionSnapshot(): void {
  clearSnapshot(SESSION_SNAPSHOT_KEY)
}
