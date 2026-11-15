import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  discardToken,
  getBearerToken,
  subscribeToToken,
  writeToken,
} from "@/data/auth/token"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//the bearer token is the one credential this device holds, and the auth
//provider follows it as a store. what has to hold: a write is readable, a drop
//is a guest, listeners hear every change, and a refused token is only dropped
//if it is still the current one.

describe("bearer token store", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads as an empty string for a guest", () => {
    expect(getBearerToken()).toBe("")
  })

  it("reads back what was written", () => {
    writeToken("abc")
    expect(getBearerToken()).toBe("abc")
  })

  it("drops the token when written null or empty", () => {
    writeToken("abc")
    writeToken(null)
    expect(getBearerToken()).toBe("")

    writeToken("abc")
    writeToken("")
    expect(getBearerToken()).toBe("")
  })

  it("does nothing, and notifies nobody, without localStorage", () => {
    vi.stubGlobal("localStorage", undefined)
    const listener = vi.fn()
    const unsubscribe = subscribeToToken(listener)

    expect(getBearerToken()).toBe("")
    writeToken("abc")

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  describe("subscribeToToken", () => {
    it("tells listeners about every write and every drop", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToToken(listener)

      writeToken("abc")
      writeToken(null)

      expect(listener).toHaveBeenCalledTimes(2)
      unsubscribe()
    })

    it("stops telling a listener once it has unsubscribed", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToToken(listener)
      unsubscribe()

      writeToken("abc")

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe("discardToken", () => {
    it("drops the token when it is the one that was refused", () => {
      writeToken("old")
      discardToken("old")
      expect(getBearerToken()).toBe("")
    })

    it("keeps a newer token when an older request was the one refused", () => {
      writeToken("new")
      const listener = vi.fn()
      const unsubscribe = subscribeToToken(listener)

      discardToken("old")

      expect(getBearerToken()).toBe("new")
      expect(listener).not.toHaveBeenCalled()
      unsubscribe()
    })
  })
})
