import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthError, signIn, signOut } from "@/data/auth/mutations"
import { writeSessionSnapshot } from "@/data/auth/session-snapshot"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//the auth SDK is its own chunk, loaded on first use, and a chunk can fail to
//arrive: a dropped connection, a deploy that replaced it. that must never cost
//the player their session, and it must still let a sign-out take effect.

vi.mock("@/data/auth/auth-client", () => {
  throw new Error("chunk failed to load")
})

beforeEach(() => {
  stubMemoryStorage()
})

describe("auth actions when the auth client fails to load", () => {
  it("a sign-in fails with an error the form reports, and keeps the token", async () => {
    writeToken("token-from-before")

    const failure = await signIn({
      username: "ada",
      password: "correct horse",
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(AuthError)
    expect(getBearerToken()).toBe("token-from-before")
  })

  it("a sign-out still signs this device out, without throwing", async () => {
    writeToken("token-from-before")
    writeSessionSnapshot(
      { id: "u1", username: "ada", displayUsername: "Ada" },
      Date.now() + 60_000,
    )

    await expect(signOut()).resolves.toBeUndefined()
    expect(getBearerToken()).toBe("")
  })
})
