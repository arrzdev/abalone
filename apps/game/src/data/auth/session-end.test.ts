import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { endSession } from "@/data/auth/session-end"
import {
  readSessionSnapshot,
  writeSessionSnapshot,
} from "@/data/auth/session-snapshot"
import {
  getBearerToken,
  subscribeToToken,
  writeToken,
} from "@/data/auth/token"
import {
  readProfileSnapshot,
  writeProfileSnapshot,
} from "@/data/profile/snapshot"
import { queryClient } from "@/providers/query-client"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//the screen this is about is a board a stalled session left behind: the token
//was dead, every request on it came back refused, and the app went on holding
//the games, the profile and the token of an account the server no longer knew.

const GAMES_KEY = ["online", "games", "active"]

/** A device that believes it is signed in, with the account's data on it. */
function signedInDevice() {
  writeToken("a-live-token")
  writeSessionSnapshot({
    id: "user-1",
    username: "teste",
    displayUsername: "teste",
  })
  writeProfileSnapshot({
    username: "teste",
    displayUsername: "teste",
    avatarUrl: null,
  })
  queryClient.setQueryData(GAMES_KEY, [{ id: "game-1" }])
}

describe("endSession", () => {
  beforeEach(() => {
    stubMemoryStorage()
    queryClient.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("drops the token the server stopped honouring", () => {
    signedInDevice()
    endSession()
    expect(getBearerToken()).toBe("")
  })

  it("drops what this device knew about the account", () => {
    signedInDevice()
    endSession()

    expect(readSessionSnapshot()).toBeNull()
    expect(readProfileSnapshot()).toBeNull()
    expect(queryClient.getQueryData(GAMES_KEY)).toBeUndefined()
  })

  //what actually moves the player off the screen: the route guard reads the
  //token, and it only re-reads it because the store said so
  it("tells the app the credential is gone", () => {
    signedInDevice()

    const listener = vi.fn()
    const unsubscribe = subscribeToToken(listener)
    endSession()
    unsubscribe()

    expect(listener).toHaveBeenCalled()
  })

  //a refused session is refused several times at once — the board polls its
  //row, its moves, and the profile behind the header — and a second pass would
  //clear a cache the player has since started filling again
  it("only ends the session once", () => {
    signedInDevice()
    endSession()

    queryClient.setQueryData(GAMES_KEY, [{ id: "game-2" }])
    endSession()

    expect(queryClient.getQueryData(GAMES_KEY)).toEqual([{ id: "game-2" }])
  })
})
