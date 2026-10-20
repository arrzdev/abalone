import tryCatch from "@repo/shared/try-catch"
import { eq, sql } from "drizzle-orm"
import { authLockouts } from "@/database/auth.schema"
import type { Db } from "@/database/client"
import { CustomError } from "@/http/errors"

//per-account lockout (stack-auth standard): 5 failed sign-ins for one
//identifier within 15 minutes lock it for 15 minutes, from whatever ip they
//come. the count only starts over 15 minutes after the LAST failure, so
//failures cannot be split across a window edge to slip under the limit (a
//slow guesser at under 15 minutes per try is locked too: stricter, on
//purpose). the cloudflare rate-limit binding cannot do this: its periods are 10 s
//or 60 s and it counts per colo. D1 is written only when a sign-in fails and
//cleared when one succeeds, so honest traffic costs one read per sign-in.
export const LOCKOUT_MAX_FAILURES = 5
export const LOCKOUT_WINDOW_MS = 15 * 60_000
export const LOCKOUT_DURATION_MS = 15 * 60_000

export type LockoutState =
  | { locked: false }
  | { locked: true; retryAfterSeconds: number }

/**
 * The key one account is counted under: the email as better-auth stores it.
 * A username sign-in is counted under the email derived from that username
 * (auth.service.ts), so /sign-in/username and /sign-in/email share one count.
 */
export function lockoutIdentifier(email: string): string {
  return email.trim().toLowerCase()
}

//---- service ----------------

export class AuthLockoutService {
  constructor(private db: Db) {}

  /** Whether the identifier is locked at `now`; checked before any hashing. */
  async check(identifier: string, now: number): Promise<LockoutState> {
    const [row, selectError] = await tryCatch(() =>
      this.db
        .select({ lockedUntil: authLockouts.lockedUntil })
        .from(authLockouts)
        .where(eq(authLockouts.identifier, identifier))
        .get(),
    )
    if (selectError)
      throw new CustomError("service_unavailable", selectError)

    const lockedUntil = row?.lockedUntil?.getTime() ?? 0
    if (lockedUntil <= now) return { locked: false }
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
    }
  }

  /**
   * Counts one failed sign-in. One upsert, so concurrent failures from many ips
   * cannot lose a count. A last failure older than 15 minutes, or a lock that
   * has ended, starts the count again at 1.
   */
  async recordFailure(identifier: string, now: number): Promise<void> {
    const at = new Date(now)
    const restart = sql`(${authLockouts.lastFailedAt} <= ${now - LOCKOUT_WINDOW_MS} or coalesce(${authLockouts.lockedUntil}, ${now + 1}) <= ${now})`
    const nextCount = sql`case when ${restart} then 1 else ${authLockouts.failedCount} + 1 end`

    const [, upsertError] = await tryCatch(() =>
      this.db
        .insert(authLockouts)
        .values({
          identifier,
          failedCount: 1,
          lastFailedAt: at,
          lockedUntil: null,
        })
        .onConflictDoUpdate({
          target: authLockouts.identifier,
          set: {
            failedCount: nextCount,
            lastFailedAt: at,
            lockedUntil: sql`case when ${nextCount} >= ${LOCKOUT_MAX_FAILURES} then ${now + LOCKOUT_DURATION_MS} else null end`,
          },
        }),
    )
    if (upsertError)
      throw new CustomError("service_unavailable", upsertError)
  }

  /** Forgets the failures after a successful sign-in. */
  async reset(identifier: string): Promise<void> {
    const [, deleteError] = await tryCatch(() =>
      this.db
        .delete(authLockouts)
        .where(eq(authLockouts.identifier, identifier)),
    )
    if (deleteError)
      throw new CustomError("service_unavailable", deleteError)
  }
}
