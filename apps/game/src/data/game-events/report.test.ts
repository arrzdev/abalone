import { afterEach, describe, expect, it, vi } from "vitest"
import { backendBaseUrl } from "@/data/backend-client"
import { reportGameEvent } from "@/data/game-events/report"

const EVENTS_URL = `${backendBaseUrl}/api/v1/events/game`

const start = {
  gameRef: "6f1c2b8e-3a51-4f0e-9d7c-2b1a4c5d6e7f",
  kind: "start",
  mode: "ai",
  botLevel: 3,
} as const

//whatever went out on the wire, read back as the object it was built from
async function sentBody(body: unknown): Promise<unknown> {
  if (typeof body === "string") return JSON.parse(body)
  return JSON.parse(await (body as Blob).text())
}

//lets a rejected promise the reporter left behind surface as an unhandled
//rejection, which vitest fails the test on
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("reportGameEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("sends the event as a beacon, with the build it came from", async () => {
    const sendBeacon = vi.fn(() => true)
    const fetch = vi.fn()
    vi.stubGlobal("navigator", { ...navigator, sendBeacon })
    vi.stubGlobal("fetch", fetch)

    reportGameEvent(start)

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, body] = sendBeacon.mock.calls[0] as unknown as [
      string,
      unknown,
    ]
    expect(url).toBe(EVENTS_URL)
    expect(await sentBody(body)).toEqual({
      ...start,
      appVersion: expect.any(String),
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("says the event is automated when a test drives the browser", async () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal("navigator", {
      ...navigator,
      sendBeacon,
      webdriver: true,
    })

    reportGameEvent(start)

    const [, body] = sendBeacon.mock.calls[0] as unknown as [
      string,
      unknown,
    ]
    expect(await sentBody(body)).toMatchObject({
      ...start,
      automated: true,
    })
  })

  it("says nothing about automation for a player's browser", async () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal("navigator", {
      ...navigator,
      sendBeacon,
      webdriver: false,
    })

    reportGameEvent(start)

    const [, body] = sendBeacon.mock.calls[0] as unknown as [
      string,
      unknown,
    ]
    expect(await sentBody(body)).not.toHaveProperty("automated")
  })

  it("falls back to a keepalive fetch when the beacon is refused", async () => {
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: () => false })
    const fetch = vi.fn(() => Promise.resolve(new Response(null)))
    vi.stubGlobal("fetch", fetch)

    reportGameEvent(start)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(EVENTS_URL)
    expect(init.method).toBe("POST")
    expect(init.keepalive).toBe(true)
    expect(await sentBody(init.body)).toMatchObject(start)
  })

  it("swallows a network that is down", async () => {
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined })
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )

    expect(() => reportGameEvent(start)).not.toThrow()
    await settle()
  })

  it("swallows a beacon and a fetch that both throw outright", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      sendBeacon: () => {
        throw new TypeError("Illegal invocation")
      },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new TypeError("fetch is not a function")
      }),
    )

    expect(() => reportGameEvent(start)).not.toThrow()
    await settle()
  })

  it("does nothing where there is no browser to send from", () => {
    vi.stubGlobal("navigator", undefined)
    vi.stubGlobal("fetch", undefined)

    expect(() => reportGameEvent(start)).not.toThrow()
  })
})
