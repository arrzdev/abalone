import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { apiError } from "@/data/backend-client"
import { stubMemoryStorage } from "@/test-support/memory-storage"

describe("apiError", () => {
  beforeEach(() => {
    stubMemoryStorage()
    writeToken("a-live-token")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  //the whole point: the api saying "not you" is the only notice this device
  //gets that its session is over, and it used to be spent on a red line
  it("ends the session the server refused", () => {
    apiError("unauthorized")
    expect(getBearerToken()).toBe("")
  })

  it("leaves the session alone for a failure about the game", () => {
    apiError("not_your_turn")
    expect(getBearerToken()).toBe("a-live-token")
  })

  //the code still has to reach the screen that translates it
  it("carries the code it was given", () => {
    expect(apiError("illegal_move").message).toBe("illegal_move")
  })
})
