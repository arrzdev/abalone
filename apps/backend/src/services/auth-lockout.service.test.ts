import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { getDb } from "@/database/client"
import {
  AuthLockoutService,
  LOCKOUT_DURATION_MS,
  LOCKOUT_MAX_FAILURES,
  LOCKOUT_WINDOW_MS,
  lockoutIdentifier,
} from "@/services/auth-lockout.service"
import { failingD1 } from "@/test-support/failing-bindings"

/**
 * The counting rules, driven at the service with a clock the test controls.
 *
 * The auth route tests prove a locked account is refused over http; here the
 * clock is a plain number, so the window edges are exact instead of waited for.
 */
describe("auth lockout service", () => {
  const lockouts = new AuthLockoutService(getDb(env.DB))
  const start = Date.UTC(2026, 0, 1)

  async function failTimes(identifier: string, times: number, at: number) {
    for (let failure = 0; failure < times; failure++) {
      await lockouts.recordFailure(identifier, at)
    }
  }

  it("normalises the identifier the way better-auth stores an email", () => {
    expect(lockoutIdentifier("  Player@Users.Abalone.Invalid ")).toBe(
      "player@users.abalone.invalid",
    )
  })

  it("leaves an account with no failures unlocked", async () => {
    expect(await lockouts.check("never-failed", start)).toEqual({
      locked: false,
    })
  })

  it("stays unlocked one failure short of the limit", async () => {
    await failTimes("almost", LOCKOUT_MAX_FAILURES - 1, start)

    expect(await lockouts.check("almost", start)).toEqual({
      locked: false,
    })
  })

  it("locks on the last allowed failure and says when to come back", async () => {
    await failTimes("locked", LOCKOUT_MAX_FAILURES, start)

    expect(await lockouts.check("locked", start + 1000)).toEqual({
      locked: true,
      retryAfterSeconds: (LOCKOUT_DURATION_MS - 1000) / 1000,
    })
  })

  it("unlocks once the lock has run out", async () => {
    await failTimes("expired", LOCKOUT_MAX_FAILURES, start)

    expect(
      await lockouts.check("expired", start + LOCKOUT_DURATION_MS),
    ).toEqual({ locked: false })
  })

  it("starts the count over after a quiet window", async () => {
    await failTimes("quiet", LOCKOUT_MAX_FAILURES - 1, start)
    const later = start + LOCKOUT_WINDOW_MS
    await lockouts.recordFailure("quiet", later)

    expect(await lockouts.check("quiet", later)).toEqual({ locked: false })
  })

  it("forgets every failure after a successful sign-in", async () => {
    await failTimes("forgiven", LOCKOUT_MAX_FAILURES - 1, start)
    await lockouts.reset("forgiven")
    await lockouts.recordFailure("forgiven", start)

    expect(await lockouts.check("forgiven", start)).toEqual({
      locked: false,
    })
  })

  //---- D1 down ----------------

  it("answers service_unavailable on every call when D1 is down", async () => {
    const broken = new AuthLockoutService(getDb(failingD1()))

    await expect(broken.check("down", start)).rejects.toMatchObject({
      errorCode: "service_unavailable",
    })
    await expect(
      broken.recordFailure("down", start),
    ).rejects.toMatchObject({
      errorCode: "service_unavailable",
    })
    await expect(broken.reset("down")).rejects.toMatchObject({
      errorCode: "service_unavailable",
    })
  })
})
