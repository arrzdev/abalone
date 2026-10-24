import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthError, signIn, signOut } from "@/data/auth/mutations"
import {
  readSessionSnapshot,
  writeSessionSnapshot,
} from "@/data/auth/session-snapshot"
import { getBearerToken, writeToken } from "@/data/auth/token"
import i18n from "@/i18n"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//better-auth's client takes hold of `fetch` when it is built, at import, so the
//stand-in goes in before any import runs and each test says what it answers
const network = vi.hoisted(() => {
  const state: { answer: () => Promise<Response> } = {
    answer: async () => {
      throw new TypeError("no answer arranged")
    },
  }
  globalThis.fetch = (() => state.answer()) as typeof fetch
  return state
})

//the client half of the auth standard (stack-auth): what the player is told
//when their account is locked, and a sign-out that holds even when the server
//cannot be reached. the network is a stubbed `fetch`, so these run the real
//better-auth client against canned answers.

function answer(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

/** The rejection signIn() ends in, or a failure if it resolved. */
async function signInFailure(): Promise<AuthError> {
  const outcome = await signIn({
    username: "kasparov",
    password: "correct-horse",
  }).then(
    () => null,
    (error: unknown) => error,
  )
  expect(outcome).toBeInstanceOf(AuthError)
  return outcome as AuthError
}

describe("signIn on a locked account", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  //the backend's answer for an account with 5 failed sign-ins in 15 minutes:
  //the app envelope, 429, and how long the lock has left in Retry-After. the
  //player is told to try later, never how long (board: no lockout timeout in
  //any product)
  it("says try again later, never how long: Too many attempts. Try again later.", async () => {
    network.answer = async () =>
      answer(
        429,
        { status: "error", error_code: "auth_account_locked" },
        { "Retry-After": "840" },
      )

    const error = await signInFailure()

    expect(error.code).toBe("account_locked")
    expect(error).not.toHaveProperty("retryAfterMinutes")
    expect(i18n.t(`common:auth.errors.${error.code}`)).toBe(
      "Too many attempts. Try again later.",
    )
  })

  //no Retry-After (a proxy dropped it) is still a lock, with the same sentence
  it("is a lock without a Retry-After too", async () => {
    network.answer = async () =>
      answer(429, { status: "error", error_code: "auth_account_locked" })

    const error = await signInFailure()
    expect(error.code).toBe("account_locked")
  })

  it("still says the name and password don't match for a plain wrong password", async () => {
    network.answer = async () =>
      answer(401, {
        code: "INVALID_USERNAME_OR_PASSWORD",
        message: "Invalid username or password",
      })

    expect((await signInFailure()).code).toBe("invalid_credentials")
  })
})

describe("signOut", () => {
  beforeEach(() => {
    stubMemoryStorage()
    writeToken("a-live-token")
    writeSessionSnapshot({
      id: "user-1",
      username: "kasparov",
      displayUsername: "Kasparov",
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("clears the token and the cached session even when the server cannot be reached", async () => {
    network.answer = async () => {
      throw new TypeError("Failed to fetch")
    }

    await signOut().catch(() => undefined)

    expect(getBearerToken()).toBe("")
    expect(readSessionSnapshot()).toBeNull()
  })

  it("clears the token and the cached session when the server answers 503", async () => {
    network.answer = async () =>
      answer(503, { status: "error", error_code: "service_unavailable" })

    await signOut().catch(() => undefined)

    expect(getBearerToken()).toBe("")
    expect(readSessionSnapshot()).toBeNull()
  })
})
