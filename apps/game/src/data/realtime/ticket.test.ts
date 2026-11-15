import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { writeToken } from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"
import { mintTicket } from "@/data/realtime/ticket"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { jsonResponse, stubFetch } from "@/test-support/stub-fetch"

//the ticket is an ordinary rpc call that carries the bearer token and hands
//back something the socket can redeem. the network is a stubbed `fetch`.

describe("mintTicket", () => {
  beforeEach(() => {
    stubMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts to the ticket route with the bearer token and returns the ticket", async () => {
    writeToken("session-token")
    const network = stubFetch(() =>
      jsonResponse(200, { status: "success", data: { ticket: "t-123" } }),
    )

    expect(await mintTicket()).toBe("t-123")

    const request = network.last()
    expect(request.method).toBe("POST")
    expect(request.url).toBe(`${backendBaseUrl}/api/v1/realtime/ticket`)
    expect(request.headers.get("authorization")).toBe(
      "Bearer session-token",
    )
  })

  it("throws the api's error code when the server refuses", async () => {
    stubFetch(() =>
      jsonResponse(429, {
        status: "error",
        error_code: "rate_limit_exceeded",
      }),
    )

    await expect(mintTicket()).rejects.toThrow("rate_limit_exceeded")
  })

  it("throws network_unreachable when the request never lands", async () => {
    stubFetch(() => {
      throw new TypeError("failed to fetch")
    })

    await expect(mintTicket()).rejects.toThrow("network_unreachable")
  })
})
