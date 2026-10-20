import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readSessionSnapshot } from "@/data/auth/session-snapshot"
import { writeToken } from "@/data/auth/token"
import { needsSignIn } from "@/routing/auth-guard"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//the client half of the auth standard (stack-auth): the cached session is a
//summary that knows when it ends. a summary past its `expiresAt` is denied at
//once, without waiting for the api to say so, and a live one paints at once
//while the api re-checks it in the background.
//
//the snapshot is seeded the way the app stores it — `{ user, expiresAt }` under
//`abalone.session`, expiresAt in epoch milliseconds — so these read what a
//device really holds after a cold start.

const SESSION_SNAPSHOT_KEY = "abalone.session"
const PLAYER = {
  id: "user-1",
  username: "kasparov",
  displayUsername: "Kasparov",
}

function deviceHolding(expiresAt: number) {
  writeToken("a-token")
  localStorage.setItem(
    SESSION_SNAPSHOT_KEY,
    JSON.stringify({ user: PLAYER, expiresAt }),
  )
}

describe("the cached session summary", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("serves a live summary at once", () => {
    deviceHolding(Date.now() + 60 * 60_000)
    expect(readSessionSnapshot()?.user).toEqual(PLAYER)
    expect(needsSignIn()).toBe(false)
  })

  it("does not paint a signed-in player from a summary past its expiry", () => {
    deviceHolding(Date.now() - 1_000)
    expect(readSessionSnapshot()?.user ?? null).toBeNull()
  })

  it("sends a device whose cached session has expired to sign in at once", () => {
    deviceHolding(Date.now() - 1_000)
    expect(needsSignIn()).toBe(true)
  })
})
