import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { apiError, resolveBackendBaseUrl } from "@/data/backend-client"
import { stubMemoryStorage } from "@/test-support/memory-storage"

describe("resolveBackendBaseUrl", () => {
  const phone = {
    origin: "http://192.168.1.20:6161",
    protocol: "http:",
    hostname: "192.168.1.20",
  }
  const site = {
    origin: "https://babaluje.tudu.dev",
    protocol: "https:",
    hostname: "babaluje.tudu.dev",
  }

  //the api answers under /api on every domain the game is served from, so a
  //production build must never reach for another host
  it("calls the page's own origin in production", () => {
    expect(
      resolveBackendBaseUrl({
        isDev: false,
        configured: "https://api.abalone.tudu.dev",
        location: site,
      }),
    ).toBe("https://babaluje.tudu.dev")
  })

  it("keeps the backend port on the page's hostname in dev", () => {
    expect(
      resolveBackendBaseUrl({
        isDev: true,
        configured: "http://localhost:8181",
        location: phone,
      }),
    ).toBe("http://192.168.1.20:8181")
  })

  //better-auth's client throws on a relative base url while the build prerenders
  it("has an absolute origin when there is no page", () => {
    expect(
      resolveBackendBaseUrl({
        isDev: false,
        configured: undefined,
        location: undefined,
      }),
    ).toBe("http://localhost")
  })
})

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
